import client from "./client";
import type {
  Employee,
  EmployeeList,
  EmployeeCreate,
  EmployeeUpdate,
  UserProfileCreate,
} from "../types";

export async function listEmployees(
  page = 1,
  size = 10,
  search?: string,
  department?: string,
): Promise<EmployeeList> {
  const params: Record<string, unknown> = { page, size };
  if (search) params.search = search;
  if (department) params.department = department;
  const { data } = await client.get<EmployeeList>("/v1/employees", { params });
  return data;
}

export async function getEmployee(id: number): Promise<Employee> {
  const { data } = await client.get<Employee>(`/v1/employees/${id}`);
  return data;
}

export async function createEmployee(payload: EmployeeCreate): Promise<Employee> {
  const { data } = await client.post<Employee>("/v1/employees", payload);
  return data;
}

export async function updateEmployee(id: number, payload: EmployeeUpdate): Promise<Employee> {
  const { data } = await client.put<Employee>(`/v1/employees/${id}`, payload);
  return data;
}

export async function deleteEmployee(id: number): Promise<void> {
  await client.delete(`/v1/employees/${id}`);
}

export async function attachUserToEmployee(
  employeeId: number,
  payload: UserProfileCreate,
): Promise<Employee> {
  const { data } = await client.post<Employee>(`/v1/employees/${employeeId}/user`, payload);
  return data;
}
