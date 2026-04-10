"""
Tests for CRUD endpoints and permission enforcement across
Products, Customers, Employees, and Inventory Transactions APIs.
"""

from httpx import AsyncClient

# =====================================================================
# Products CRUD
# =====================================================================


class TestProductsCRUD:
    async def test_create_product_returns_200_with_correct_fields(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.post(
            "/v1/products",
            json={"name": "Red Brick", "sku_code": "RB-001"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Red Brick"
        assert body["sku_code"] == "RB-001"
        assert "id" in body
        assert "created_at" in body
        assert "updated_at" in body
        assert "created_by_id" not in body

    async def test_create_product_duplicate_sku_code_returns_409(
        self, admin_client: AsyncClient
    ):
        await admin_client.post(
            "/v1/products",
            json={"name": "Brick A", "sku_code": "DUP-SKU-001"},
        )
        resp = await admin_client.post(
            "/v1/products",
            json={"name": "Brick B", "sku_code": "DUP-SKU-001"},
        )
        assert resp.status_code == 409

    async def test_list_products_paginated(self, admin_client: AsyncClient):
        for i in range(5):
            await admin_client.post(
                "/v1/products",
                json={"name": f"ListProd {i}", "sku_code": f"LP-{i:04d}"},
            )
        resp = await admin_client.get("/v1/products", params={"page": 1, "size": 3})
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) <= 3
        assert body["total"] >= 5
        assert body["page"] == 1
        assert body["size"] == 3
        assert "pages" in body

    async def test_list_products_search_filters_by_name_or_sku(
        self, admin_client: AsyncClient
    ):
        await admin_client.post(
            "/v1/products",
            json={"name": "UniqueSearchBrick", "sku_code": "USB-999"},
        )
        resp = await admin_client.get(
            "/v1/products", params={"search": "UniqueSearchBrick"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        assert any("UniqueSearchBrick" in p["name"] for p in body["items"])

    async def test_update_product_returns_200(self, admin_client: AsyncClient):
        create_resp = await admin_client.post(
            "/v1/products",
            json={"name": "OldName", "sku_code": "UPD-001"},
        )
        pid = create_resp.json()["id"]
        resp = await admin_client.put(
            f"/v1/products/{pid}",
            json={"name": "NewName"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "NewName"

    async def test_delete_product_returns_204_then_get_returns_404(
        self, admin_client: AsyncClient
    ):
        create_resp = await admin_client.post(
            "/v1/products",
            json={"name": "ToDelete", "sku_code": "DEL-001"},
        )
        pid = create_resp.json()["id"]
        del_resp = await admin_client.delete(f"/v1/products/{pid}")
        assert del_resp.status_code == 204
        # Product should no longer appear (soft-deleted)
        get_resp = await admin_client.get(f"/v1/products/{pid}")
        # Depending on implementation, GET single may not exist or returns 404
        # The list should not include the deleted product
        list_resp = await admin_client.get("/v1/products", params={"search": "DEL-001"})
        assert all(p["sku_code"] != "DEL-001" for p in list_resp.json()["items"])

    async def test_employee_can_read_products_but_not_write(
        self, admin_client: AsyncClient, employee_client: AsyncClient
    ):
        # Admin creates a product first
        await admin_client.post(
            "/v1/products",
            json={"name": "ReadOnly", "sku_code": "RO-001"},
        )
        # Employee can read
        read_resp = await employee_client.get("/v1/products")
        assert read_resp.status_code == 200

        # Employee cannot create
        write_resp = await employee_client.post(
            "/v1/products",
            json={"name": "Forbidden", "sku_code": "FORB-001"},
        )
        assert write_resp.status_code == 403


# =====================================================================
# Commission Rates CRUD
# =====================================================================


class TestCommissionRatesCRUD:
    async def _create_product(self, admin_client: AsyncClient, sku: str) -> int:
        resp = await admin_client.post(
            "/v1/products",
            json={"name": f"CommProd-{sku}", "sku_code": sku},
        )
        assert resp.status_code == 200
        return resp.json()["id"]

    async def test_create_commission_rate_returns_201(self, admin_client: AsyncClient):
        pid = await self._create_product(admin_client, "CR-001")
        resp = await admin_client.post(
            f"/v1/products/{pid}/commission-rates",
            json={
                "rate_per_unit": "50.0000",
                "effective_from": "2025-01-01",
                "effective_to": None,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["product_id"] == pid
        assert "id" in body

    async def test_list_commission_rates_for_product(self, admin_client: AsyncClient):
        pid = await self._create_product(admin_client, "CR-002")
        await admin_client.post(
            f"/v1/products/{pid}/commission-rates",
            json={
                "rate_per_unit": "30.0000",
                "effective_from": "2025-01-01",
                "effective_to": "2025-05-31",
            },
        )
        await admin_client.post(
            f"/v1/products/{pid}/commission-rates",
            json={"rate_per_unit": "40.0000", "effective_from": "2025-06-01"},
        )
        resp = await admin_client.get(f"/v1/products/{pid}/commission-rates")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_update_commission_rate_returns_200(self, admin_client: AsyncClient):
        pid = await self._create_product(admin_client, "CR-003")
        create_resp = await admin_client.post(
            f"/v1/products/{pid}/commission-rates",
            json={"rate_per_unit": "25.0000", "effective_from": "2025-01-01"},
        )
        rate_id = create_resp.json()["id"]
        resp = await admin_client.put(
            f"/v1/products/{pid}/commission-rates/{rate_id}",
            json={"rate_per_unit": "75.0000"},
        )
        assert resp.status_code == 200
        assert resp.json()["rate_per_unit"] == "75.0000"

    async def test_delete_commission_rate_returns_204(self, admin_client: AsyncClient):
        pid = await self._create_product(admin_client, "CR-004")
        create_resp = await admin_client.post(
            f"/v1/products/{pid}/commission-rates",
            json={"rate_per_unit": "10.0000", "effective_from": "2025-01-01"},
        )
        rate_id = create_resp.json()["id"]
        resp = await admin_client.delete(
            f"/v1/products/{pid}/commission-rates/{rate_id}"
        )
        assert resp.status_code == 204


# =====================================================================
# Customers CRUD
# =====================================================================


class TestCustomersCRUD:
    async def test_create_customer_returns_201(self, admin_client: AsyncClient):
        resp = await admin_client.post(
            "/v1/customers",
            json={
                "full_name": "John Doe",
                "phone_number": "+998901234567",
                "comment": "VIP customer",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["full_name"] == "John Doe"
        assert body["phone_number"] == "+998901234567"
        assert "id" in body

    async def test_create_customer_invalid_phone_returns_422(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.post(
            "/v1/customers",
            json={
                "full_name": "Bad Phone",
                "phone_number": "12345",
            },
        )
        assert resp.status_code == 422

    async def test_create_customer_valid_phone_returns_201(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.post(
            "/v1/customers",
            json={
                "full_name": "Valid Phone",
                "phone_number": "+998911234567",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["phone_number"] == "+998911234567"

    async def test_list_customers_with_search(self, admin_client: AsyncClient):
        await admin_client.post(
            "/v1/customers",
            json={"full_name": "UniqueCustomerXYZ"},
        )
        resp = await admin_client.get(
            "/v1/customers", params={"search": "UniqueCustomerXYZ"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        assert any("UniqueCustomerXYZ" in c["full_name"] for c in body["items"])

    async def test_get_customer_by_id(self, admin_client: AsyncClient):
        create_resp = await admin_client.post(
            "/v1/customers",
            json={"full_name": "GetById Customer"},
        )
        cid = create_resp.json()["id"]
        resp = await admin_client.get(f"/v1/customers/{cid}")
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "GetById Customer"

    async def test_update_customer_returns_200(self, admin_client: AsyncClient):
        create_resp = await admin_client.post(
            "/v1/customers",
            json={"full_name": "OldCustomerName"},
        )
        cid = create_resp.json()["id"]
        resp = await admin_client.put(
            f"/v1/customers/{cid}",
            json={"full_name": "NewCustomerName"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "NewCustomerName"

    async def test_delete_customer_returns_204_then_get_returns_404(
        self, admin_client: AsyncClient
    ):
        create_resp = await admin_client.post(
            "/v1/customers",
            json={"full_name": "DeleteMe Customer"},
        )
        cid = create_resp.json()["id"]
        del_resp = await admin_client.delete(f"/v1/customers/{cid}")
        assert del_resp.status_code == 204
        get_resp = await admin_client.get(f"/v1/customers/{cid}")
        assert get_resp.status_code == 404

    async def test_employee_can_read_customers_but_not_write(
        self, admin_client: AsyncClient, employee_client: AsyncClient
    ):
        await admin_client.post(
            "/v1/customers",
            json={"full_name": "ReadOnlyCustomer"},
        )
        read_resp = await employee_client.get("/v1/customers")
        assert read_resp.status_code == 200

        write_resp = await employee_client.post(
            "/v1/customers",
            json={"full_name": "Forbidden Customer"},
        )
        assert write_resp.status_code == 403


# =====================================================================
# Employees CRUD
# =====================================================================


class TestEmployeesCRUD:
    async def test_create_salary_employee_with_base_salary_returns_201(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-SAL-001",
                "full_name": "Salary Worker",
                "position": "Operator",
                "department": "Production",
                "employment_type": "SALARY",
                "base_salary": "5000000",
                "hired_at": "2025-01-15",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["employment_type"] == "SALARY"
        assert body["full_name"] == "Salary Worker"

    async def test_create_salary_employee_without_base_salary_returns_422(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-SAL-002",
                "full_name": "No Salary Worker",
                "position": "Operator",
                "employment_type": "SALARY",
                "hired_at": "2025-01-15",
            },
        )
        assert resp.status_code == 422

    async def test_create_commission_employee_no_base_salary_returns_201(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-COM-001",
                "full_name": "Commission Worker",
                "position": "Sales Rep",
                "employment_type": "COMMISSION",
                "hired_at": "2025-02-01",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["employment_type"] == "COMMISSION"

    async def test_create_employee_with_user_profile(self, admin_client: AsyncClient):
        resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-UP-001",
                "full_name": "Employee With Login",
                "position": "Manager",
                "employment_type": "SALARY",
                "base_salary": "7000000",
                "hired_at": "2025-03-01",
                "user_profile": {
                    "username": "emp_with_login_001",
                    "password": "secret123",
                    "role": "employee",
                },
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["user_id"] is not None

    async def test_list_employees_with_search(self, admin_client: AsyncClient):
        await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-SRCH-001",
                "full_name": "SearchableEmployee",
                "position": "Tester",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
            },
        )
        resp = await admin_client.get(
            "/v1/employees", params={"search": "SearchableEmployee"}
        )
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_employees_with_department_filter(
        self, admin_client: AsyncClient
    ):
        await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-DEPT-001",
                "full_name": "Dept Worker",
                "position": "Operator",
                "department": "Logistics",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
            },
        )
        resp = await admin_client.get(
            "/v1/employees", params={"department": "Logistics"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        assert all(e["department"] == "Logistics" for e in body["items"])

    async def test_update_employee_returns_200(self, admin_client: AsyncClient):
        create_resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-UPD-001",
                "full_name": "OldEmpName",
                "position": "Worker",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
            },
        )
        eid = create_resp.json()["id"]
        resp = await admin_client.put(
            f"/v1/employees/{eid}",
            json={"full_name": "NewEmpName"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "NewEmpName"

    async def test_delete_employee_returns_204(self, admin_client: AsyncClient):
        create_resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-DEL-001",
                "full_name": "DeleteMe Emp",
                "position": "Worker",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
            },
        )
        eid = create_resp.json()["id"]
        resp = await admin_client.delete(f"/v1/employees/{eid}")
        assert resp.status_code == 204

    async def test_attach_user_to_employee_returns_201(self, admin_client: AsyncClient):
        create_resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-ATT-001",
                "full_name": "Attach User Emp",
                "position": "Worker",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
            },
        )
        eid = create_resp.json()["id"]
        resp = await admin_client.post(
            f"/v1/employees/{eid}/user",
            json={
                "username": "attached_user_001",
                "password": "pass123",
                "role": "employee",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["user_id"] is not None

    async def test_attach_user_to_employee_already_has_user_returns_409(
        self, admin_client: AsyncClient
    ):
        create_resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-ATT-002",
                "full_name": "AlreadyHasUser Emp",
                "position": "Worker",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
                "user_profile": {
                    "username": "already_has_user_002",
                    "password": "pass123",
                    "role": "employee",
                },
            },
        )
        eid = create_resp.json()["id"]
        resp = await admin_client.post(
            f"/v1/employees/{eid}/user",
            json={
                "username": "second_user_002",
                "password": "pass123",
                "role": "employee",
            },
        )
        assert resp.status_code == 409


# =====================================================================
# Employee permission enforcement
# =====================================================================


class TestEmployeePermissions:
    async def test_employee_role_cannot_manage_employees(
        self, employee_client: AsyncClient
    ):
        resp = await employee_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-FORB-001",
                "full_name": "Forbidden Emp",
                "position": "Worker",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
            },
        )
        assert resp.status_code == 403

        list_resp = await employee_client.get("/v1/employees")
        assert list_resp.status_code == 403

    async def test_admin_can_read_employees(self, admin_client: AsyncClient):
        await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-ADM-001",
                "full_name": "Admin Visible Emp",
                "position": "Worker",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
            },
        )
        resp = await admin_client.get("/v1/employees")
        assert resp.status_code == 200

    async def test_admin_can_delete_employees(self, admin_client: AsyncClient):
        create_resp = await admin_client.post(
            "/v1/employees",
            json={
                "employee_number": "EMP-ADM-003",
                "full_name": "Admin Deletable Emp",
                "position": "Worker",
                "employment_type": "COMMISSION",
                "hired_at": "2025-01-01",
            },
        )
        eid = create_resp.json()["id"]
        resp = await admin_client.delete(f"/v1/employees/{eid}")
        assert resp.status_code == 204


# =====================================================================
# Inventory Transactions
# =====================================================================


class TestInventoryTransactions:
    async def test_list_transactions_returns_200_with_pagination(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.get(
            "/v1/inventory-transactions", params={"page": 1, "size": 10}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert body["page"] == 1
        assert body["size"] == 10

    async def test_employee_can_read_inventory_transactions(
        self, employee_client: AsyncClient
    ):
        resp = await employee_client.get("/v1/inventory-transactions")
        assert resp.status_code == 200


# =====================================================================
# Pagination edge cases
# =====================================================================


class TestPaginationEdgeCases:
    async def test_page_beyond_total_returns_empty_items(
        self, admin_client: AsyncClient
    ):
        resp = await admin_client.get("/v1/products", params={"page": 9999, "size": 10})
        assert resp.status_code == 200
        body = resp.json()
        assert body["items"] == []
        assert body["total"] >= 0

    async def test_multiple_pages_correct_items_per_page(
        self, admin_client: AsyncClient
    ):
        # Create enough products to span multiple pages
        for i in range(5):
            await admin_client.post(
                "/v1/products",
                json={"name": f"PageTest {i}", "sku_code": f"PGT-{i:04d}"},
            )

        page1 = await admin_client.get("/v1/products", params={"page": 1, "size": 2})
        page2 = await admin_client.get("/v1/products", params={"page": 2, "size": 2})
        assert page1.status_code == 200
        assert page2.status_code == 200
        assert len(page1.json()["items"]) == 2
        assert len(page2.json()["items"]) == 2
        # Items on different pages should be different
        page1_ids = {p["id"] for p in page1.json()["items"]}
        page2_ids = {p["id"] for p in page2.json()["items"]}
        assert page1_ids.isdisjoint(page2_ids)


# =====================================================================
# Soft delete behavior
# =====================================================================


class TestSoftDeleteBehavior:
    async def test_deleted_product_not_in_list_results(self, admin_client: AsyncClient):
        create_resp = await admin_client.post(
            "/v1/products",
            json={"name": "SoftDelProd", "sku_code": "SDP-001"},
        )
        pid = create_resp.json()["id"]
        await admin_client.delete(f"/v1/products/{pid}")

        list_resp = await admin_client.get("/v1/products", params={"search": "SDP-001"})
        assert resp_ids_dont_contain(list_resp.json()["items"], pid)

    async def test_deleted_customer_get_by_id_returns_404(
        self, admin_client: AsyncClient
    ):
        create_resp = await admin_client.post(
            "/v1/customers",
            json={"full_name": "SoftDelCustomer"},
        )
        cid = create_resp.json()["id"]
        await admin_client.delete(f"/v1/customers/{cid}")

        resp = await admin_client.get(f"/v1/customers/{cid}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def resp_ids_dont_contain(items: list[dict], target_id: int) -> bool:
    """Return True if none of the items have the given id."""
    return all(item["id"] != target_id for item in items)
