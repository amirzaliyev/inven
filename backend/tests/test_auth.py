"""
Tests for authentication, JWT tokens, password hashing, permissions,
auth service, user service, and auth/user API endpoints.
"""

import jwt as pyjwt
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    verify_access_token,
    verify_refresh_token,
)
from app.auth.passwords import hash_password, verify_hash
from app.auth.permissions import (
    Permission,
    get_permissions_for_role,
)
from app.core.config import settings
from app.models.users import UserRole
from app.schemas.auth import UserContext
from app.services.auth import AuthService
from app.services.exceptions import Conflict, UnAuthorized
from app.services.users import UserService
from tests.conftest import Factory, auth_header, make_user_context

# =====================================================================
# 1. JWT unit tests
# =====================================================================


class TestJWT:
    def _make_ctx(self, **overrides) -> UserContext:
        defaults = dict(
            id=1,
            display_name="Test",
            username="testuser",
            permissions=["products:read"],
            must_change_password=False,
        )
        defaults.update(overrides)
        return UserContext(**defaults)

    def test_create_and_verify_access_token(self):
        ctx = self._make_ctx()
        token = create_access_token(user=ctx)
        claims = verify_access_token(token)
        assert claims.sub == ctx.id
        assert claims.username == ctx.username
        assert claims.display_name == ctx.display_name
        assert claims.permissions == ctx.permissions
        assert claims.must_change_password == ctx.must_change_password

    def test_create_and_verify_refresh_token(self):
        ctx = self._make_ctx()
        token = create_refresh_token(user=ctx)
        claims = verify_refresh_token(token)
        assert claims.sub == ctx.id

    def test_expired_access_token_raises_unauthorized(self):
        ctx = self._make_ctx()
        # Manually craft an expired token
        import time

        payload = {
            "sub": str(ctx.id),
            "display_name": ctx.display_name,
            "username": ctx.username,
            "permissions": ctx.permissions,
            "must_change_password": ctx.must_change_password,
            "iat": int(time.time()) - 7200,
            "exp": int(time.time()) - 3600,
            "token_kind": "access",
        }
        token = pyjwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
        with pytest.raises(UnAuthorized):
            verify_access_token(token)

    def test_expired_refresh_token_raises_unauthorized(self):
        import time

        payload = {
            "sub": "1",
            "iat": int(time.time()) - 7200,
            "exp": int(time.time()) - 3600,
            "token_kind": "refresh",
        }
        token = pyjwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
        with pytest.raises(UnAuthorized):
            verify_refresh_token(token)

    def test_wrong_token_kind_access_raises_unauthorized(self):
        """Using a refresh token where access is expected should fail."""
        ctx = self._make_ctx()
        refresh_token = create_refresh_token(user=ctx)
        with pytest.raises(UnAuthorized):
            verify_access_token(refresh_token)

    def test_wrong_token_kind_refresh_raises_unauthorized(self):
        """Using an access token where refresh is expected should fail."""
        ctx = self._make_ctx()
        access_token = create_access_token(user=ctx)
        with pytest.raises(UnAuthorized):
            verify_refresh_token(access_token)

    def test_tampered_token_raises_unauthorized(self):
        ctx = self._make_ctx()
        token = create_access_token(user=ctx)
        # Tamper with the token by modifying a character in the signature
        parts = token.split(".")
        sig = parts[2]
        tampered_char = "A" if sig[0] != "A" else "B"
        parts[2] = tampered_char + sig[1:]
        tampered = ".".join(parts)
        with pytest.raises(UnAuthorized):
            verify_access_token(tampered)

    def test_must_change_password_preserved_in_token(self):
        ctx = self._make_ctx(must_change_password=True)
        token = create_access_token(user=ctx)
        claims = verify_access_token(token)
        assert claims.must_change_password is True


# =====================================================================
# 2. Password hashing
# =====================================================================


class TestPasswordHashing:
    def test_hash_password_returns_different_hash_each_call(self):
        h1 = hash_password("secret123")
        h2 = hash_password("secret123")
        assert h1 != h2

    def test_verify_hash_correct_password(self):
        h = hash_password("mypassword")
        assert verify_hash("mypassword", h) is True

    def test_verify_hash_wrong_password(self):
        h = hash_password("mypassword")
        assert verify_hash("wrongpassword", h) is False


# =====================================================================
# 3. Permission mapping
# =====================================================================


class TestPermissions:
    def test_admin_gets_all_permissions(self):
        perms = get_permissions_for_role("admin")
        all_perms = {p.value for p in Permission}
        assert set(perms) == all_perms

    def test_master_admin_gets_all_permissions(self):
        perms = get_permissions_for_role("master_admin")
        all_perms = {p.value for p in Permission}
        assert set(perms) == all_perms

    def test_employee_gets_read_only_subset(self):
        perms = set(get_permissions_for_role("employee"))
        assert "orders:read" in perms
        assert "batches:read" in perms
        assert "inventory:read" in perms
        assert "products:read" in perms
        assert "customers:read" in perms
        # Should NOT have write permissions
        assert "orders:write" not in perms
        assert "batches:write" not in perms
        assert "users:read" not in perms

    def test_unknown_role_gets_empty(self):
        perms = get_permissions_for_role("nonexistent_role")
        assert perms == []


# =====================================================================
# 4. Auth service
# =====================================================================


class TestAuthService:
    async def test_authenticate_valid_credentials(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user(
            username="authuser", password="correctpass", role=UserRole.ADMIN
        )
        user_svc = UserService(session, auto_commit=False)
        auth_svc = AuthService(user_service=user_svc)
        ctx = await auth_svc.authenticate("authuser", "correctpass")
        assert ctx.id == user.id
        assert ctx.username == "authuser"

    async def test_authenticate_wrong_password(
        self, session: AsyncSession, factory: Factory
    ):
        await factory.create_user(username="authuser2", password="correctpass")
        user_svc = UserService(session, auto_commit=False)
        auth_svc = AuthService(user_service=user_svc)
        with pytest.raises(UnAuthorized):
            await auth_svc.authenticate("authuser2", "wrongpass")

    async def test_authenticate_nonexistent_user(self, session: AsyncSession):
        user_svc = UserService(session, auto_commit=False)
        auth_svc = AuthService(user_service=user_svc)
        with pytest.raises(UnAuthorized):
            await auth_svc.authenticate("no_such_user", "password")

    async def test_authenticate_deactivated_user(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user(username="inactive_user", password="pass123")
        user.is_active = False
        await session.flush()
        user_svc = UserService(session, auto_commit=False)
        auth_svc = AuthService(user_service=user_svc)
        with pytest.raises(UnAuthorized):
            await auth_svc.authenticate("inactive_user", "pass123")


# =====================================================================
# 5. User service
# =====================================================================


class TestUserService:
    async def test_create_user_hashes_password_and_sets_must_change(
        self, session: AsyncSession
    ):
        from app.schemas.users import UserCreate

        svc = UserService(session, auto_commit=False)
        data = UserCreate(
            username="newuser",
            password="plaintext",
            display_name="New User",
            role=UserRole.EMPLOYEE,
        )
        user = await svc.create_user(data=data)
        assert user.password_hash != "plaintext"
        assert user.must_change_password is True
        assert verify_hash("plaintext", user.password_hash)

    async def test_create_duplicate_username_raises_conflict(
        self, session: AsyncSession, factory: Factory
    ):
        from app.schemas.users import UserCreate

        await factory.create_user(username="dupeuser")
        svc = UserService(session, auto_commit=False)
        data = UserCreate(
            username="dupeuser",
            password="pass",
            display_name="Dupe",
        )
        with pytest.raises(Conflict):
            await svc.create_user(data=data)

    async def test_change_password_wrong_current_raises_unauthorized(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user(username="chpwuser", password="oldpass")
        svc = UserService(session, auto_commit=False)
        with pytest.raises(UnAuthorized):
            await svc.change_password(user.id, "wrongcurrent", "newpass")

    async def test_change_password_success_sets_must_change_false(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user(
            username="chpwok", password="oldpass", must_change_password=True
        )
        svc = UserService(session, auto_commit=False)
        updated = await svc.change_password(user.id, "oldpass", "newpass123")
        assert updated.must_change_password is False
        assert verify_hash("newpass123", updated.password_hash)

    async def test_reset_password_sets_must_change_true(
        self, session: AsyncSession, factory: Factory
    ):
        user = await factory.create_user(
            username="resetpw", password="oldpass", must_change_password=False
        )
        svc = UserService(session, auto_commit=False)
        updated = await svc.reset_password(user.id, "brandnew")
        assert updated.must_change_password is True
        assert verify_hash("brandnew", updated.password_hash)

    async def test_list_with_search_filters(
        self, session: AsyncSession, factory: Factory
    ):
        await factory.create_user(username="alice_search", display_name="Alice Smith")
        await factory.create_user(username="bob_search", display_name="Bob Jones")
        svc = UserService(session, auto_commit=False)
        users, total = await svc.list(page=1, size=10, search="alice")
        assert total >= 1
        assert all(
            "alice" in u.username.lower() or "alice" in u.display_name.lower()
            for u in users
        )

    async def test_list_with_role_filter(self, session: AsyncSession, factory: Factory):
        await factory.create_user(username="emp_filter", role=UserRole.EMPLOYEE)
        await factory.create_user(username="admin_filter", role=UserRole.ADMIN)
        svc = UserService(session, auto_commit=False)
        users, total = await svc.list(page=1, size=10, role=UserRole.EMPLOYEE)
        assert total >= 1
        assert all(u.role == UserRole.EMPLOYEE for u in users)


# =====================================================================
# 6. Auth API endpoints
# =====================================================================


class TestAuthAPI:
    async def test_login_success_returns_token_and_cookie(
        self, client: AsyncClient, factory: Factory
    ):
        await factory.create_user(username="loginok", password="secret123")
        resp = await client.post(
            "/v1/auth/token",
            json={"username": "loginok", "password": "secret123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "Bearer"
        assert "refresh_token" in resp.cookies

    async def test_login_fail_returns_401(self, client: AsyncClient, factory: Factory):
        await factory.create_user(username="loginfail", password="real")
        resp = await client.post(
            "/v1/auth/token",
            json={"username": "loginfail", "password": "wrong"},
        )
        assert resp.status_code == 401

    async def test_refresh_with_valid_cookie_returns_new_token(
        self, client: AsyncClient, factory: Factory
    ):
        user = await factory.create_user(username="refreshuser", password="pass123")
        # Create a refresh token directly and pass it as a cookie
        from app.auth.jwt import create_refresh_token

        ctx = make_user_context(user)
        refresh_token = create_refresh_token(user=ctx)
        client.cookies.set("refresh_token", refresh_token)
        refresh_resp = await client.post("/v1/auth/refresh")
        assert refresh_resp.status_code == 200
        assert "access_token" in refresh_resp.json()

    async def test_refresh_without_cookie_returns_401(self, client: AsyncClient):
        resp = await client.post("/v1/auth/refresh")
        assert resp.status_code == 401

    async def test_logout_clears_cookie(self, client: AsyncClient, factory: Factory):
        user = await factory.create_user(username="logoutuser", password="pass")
        headers = auth_header(user)
        resp = await client.post("/v1/auth/logout", headers=headers)
        assert resp.status_code == 204
        # The response should instruct the browser to delete the cookie
        set_cookie = resp.headers.get("set-cookie", "")
        assert "refresh_token" in set_cookie

    async def test_change_password_success(self, client: AsyncClient, factory: Factory):
        user = await factory.create_user(username="chpwapi", password="oldpass")
        headers = auth_header(user)
        resp = await client.post(
            "/v1/auth/change-password",
            json={"current_password": "oldpass", "new_password": "newpass123"},
            headers=headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body

    async def test_change_password_wrong_current_returns_401(
        self, client: AsyncClient, factory: Factory
    ):
        user = await factory.create_user(username="chpwapifail", password="real")
        headers = auth_header(user)
        resp = await client.post(
            "/v1/auth/change-password",
            json={"current_password": "wrong", "new_password": "new"},
            headers=headers,
        )
        assert resp.status_code == 401

    async def test_empty_username_login(self, client: AsyncClient):
        resp = await client.post(
            "/v1/auth/token",
            json={"username": "", "password": ""},
        )
        # Should fail with 401 (invalid credentials) or 422 (validation)
        assert resp.status_code in (401, 422)

    async def test_user_with_must_change_password_still_gets_token(
        self, client: AsyncClient, factory: Factory
    ):
        await factory.create_user(
            username="mustchange", password="pass", must_change_password=True
        )
        resp = await client.post(
            "/v1/auth/token",
            json={"username": "mustchange", "password": "pass"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        # Verify the token carries must_change_password=True
        claims = verify_access_token(body["access_token"])
        assert claims.must_change_password is True


# =====================================================================
# 7. User API endpoints
# =====================================================================


class TestUserAPI:
    async def test_create_user_returns_201(self, admin_client: AsyncClient):
        resp = await admin_client.post(
            "/v1/users",
            json={
                "username": "api_newuser",
                "password": "secret",
                "display_name": "API New User",
                "role": "employee",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["username"] == "api_newuser"
        assert body["must_change_password"] is True

    async def test_list_users_with_pagination(
        self, admin_client: AsyncClient, factory: Factory
    ):
        # Create a few extra users
        for i in range(3):
            await factory.create_user(username=f"listuser_{i}")
        resp = await admin_client.get("/v1/users", params={"page": 1, "size": 2})
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert len(body["items"]) <= 2
        assert body["page"] == 1
        assert body["size"] == 2
        assert body["total"] >= 3

    async def test_get_user_by_id(self, admin_client: AsyncClient, factory: Factory):
        user = await factory.create_user(username="getbyid_user")
        resp = await admin_client.get(f"/v1/users/{user.id}")
        assert resp.status_code == 200
        assert resp.json()["username"] == "getbyid_user"

    async def test_update_user(self, admin_client: AsyncClient, factory: Factory):
        user = await factory.create_user(username="updateme")
        resp = await admin_client.put(
            f"/v1/users/{user.id}",
            json={"display_name": "Updated Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Updated Name"

    async def test_delete_user_soft(self, admin_client: AsyncClient, factory: Factory):
        user = await factory.create_user(username="deleteme")
        resp = await admin_client.delete(f"/v1/users/{user.id}")
        assert resp.status_code == 204
        # User should no longer be found (soft-deleted)
        get_resp = await admin_client.get(f"/v1/users/{user.id}")
        assert get_resp.status_code == 404

    async def test_employee_cannot_create_users(self, employee_client: AsyncClient):
        resp = await employee_client.post(
            "/v1/users",
            json={
                "username": "forbidden_create",
                "password": "secret",
                "display_name": "Nope",
            },
        )
        assert resp.status_code == 403

    async def test_employee_cannot_delete_users(
        self, employee_client: AsyncClient, factory: Factory
    ):
        user = await factory.create_user(username="forbid_delete")
        resp = await employee_client.delete(f"/v1/users/{user.id}")
        assert resp.status_code == 403

    async def test_reset_password_via_api(
        self, admin_client: AsyncClient, factory: Factory
    ):
        user = await factory.create_user(username="resetpwapi", password="old")
        resp = await admin_client.post(
            f"/v1/users/{user.id}/reset-password",
            json={"new_password": "brandnew123"},
        )
        assert resp.status_code == 204

    async def test_list_users_with_search(
        self, admin_client: AsyncClient, factory: Factory
    ):
        await factory.create_user(
            username="searchable_xyz", display_name="Unique Name XYZ"
        )
        resp = await admin_client.get("/v1/users", params={"search": "xyz"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1

    async def test_list_users_with_role_filter(
        self, admin_client: AsyncClient, factory: Factory
    ):
        await factory.create_user(username="employee_api_test", role=UserRole.EMPLOYEE)
        resp = await admin_client.get("/v1/users", params={"role": "employee"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        assert all(u["role"] == "employee" for u in body["items"])
