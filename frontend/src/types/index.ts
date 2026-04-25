// Auth
export interface UserCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  access_token_expires_in: number;
}

// Products
export interface Product {
  id: number;
  name: string;
  sku_code: string;
}

export interface ProductCreate {
  name: string;
  sku_code: string;
}

export interface ProductUpdate {
  name?: string;
  sku_code?: string;
}

export interface ProductList {
  items: Product[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Batches
export interface Batch {
  id: number;
  batch_date: string;
  product_id: number;
  product_name?: string;
  quantity: number;
  is_confirmed: boolean;
  subdivision_id: number | null;
  subdivision: { id: number; name: string } | null;
  created_at: string;
  update_at: string;
  created_by_id: number | null;
  updated_by_id: number | null;
}

export interface BatchCreate {
  batch_date: string;
  product_id: number;
  quantity: number;
  subdivision_id?: number | null;
  absent_employee_ids?: number[];
}

export interface BatchUpdate {
  batch_date?: string;
  product_id?: number;
  quantity?: number;
  subdivision_id?: number | null;
}

export interface BatchList {
  items: Batch[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Inventory Transactions
export const TransactionType = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const SourceType = {
  SALES: "SALES",
  DEFECT: "DEFECT",
  BATCH: "BATCH",
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export interface ITransactionLineCreate {
  product_id: number;
  quantity: number;
}

export interface InventoryTransactionCreate {
  transaction_date: string;
  transaction_type: TransactionType;
  source_type: SourceType;
  source_id: number;
  lines: ITransactionLineCreate[];
}

export interface InventoryTransaction {
  id: number;
  transaction_date: string;
  transaction_type: TransactionType;
  source_type: SourceType;
  source_id: number;
  lines: Array<{ product_id: number; quantity: number }>;
}

export interface InventoryTransactionList {
  items: InventoryTransaction[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface DefectReportCreate {
  note: string;
  lines: ITransactionLineCreate[];
}

// Customers
export interface Customer {
  id: number;
  full_name: string;
  phone_number: string | null;
  comment: string | null;
}

export interface CustomerCreate {
  full_name: string;
  phone_number?: string | null;
  comment?: string | null;
}

export interface CustomerUpdate {
  full_name?: string;
  phone_number?: string | null;
  comment?: string | null;
}

export interface CustomerList {
  items: Customer[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Orders
export const OrderStatus = {
  DRAFT: "DRAFT",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  price: string;
}

export interface Order {
  id: number;
  status: OrderStatus;
  order_date: string;
  total_amount: string;
  customer_id: number;
  customer: { id: number; full_name: string; phone_number: string | null } | null;
  items: OrderItem[];
}

export interface OrderItemCreate {
  product_id: number;
  quantity: number;
  price: number;
}

export interface OrderCreate {
  order_date: string;
  customer_id: number;
  items: OrderItemCreate[];
}

export interface OrderUpdate {
  order_date?: string;
  customer_id?: number;
  items?: OrderItemCreate[];
}

export interface OrderList {
  items: Order[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Dashboard
export interface StockLevel {
  product_id: number;
  product_name: string;
  sku_code: string;
  quantity: number;
}
export interface TodayProduction {
  product_id: number;
  product_name: string;
  total_quantity: number;
  batch_count: number;
}
export interface TodaySale {
  product_id: number;
  product_name: string;
  total_quantity: number;
  order_count: number;
}
export interface DashboardData {
  stock_levels: StockLevel[];
  today_production: TodayProduction[];
  today_sales: TodaySale[];
  order_stats: { draft: number; completed: number; cancelled: number };
  revenue_this_month: number;
  payroll_stats: { draft: number; approved: number; paid: number };
  workforce: { salary_employees: number; commission_employees: number; subdivision_count: number };
}

// Errors
export interface ApiError {
  code: string;
  message: string;
}

// Users
export interface PermissionResponse {
  permission: string;
}
export interface UserResponse {
  id: number;
  display_name: string;
  username: string;
  role: string;
  email: string | null;
  phone_number: string | null;
  must_change_password: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  custom_permissions: PermissionResponse[];
}
export interface UserCreate {
  display_name: string;
  username: string;
  password: string;
  role: string;
  email?: string | null;
  phone_number?: string | null;
  permissions?: string[] | null;
}
export interface UserUpdate {
  display_name?: string;
  role?: string;
  email?: string | null;
  phone_number?: string | null;
  permissions?: string[] | null;
}
export interface AdminPasswordReset {
  new_password: string;
}
export interface UserList {
  items: UserResponse[];
  total: number;
  page: number;
  size: number;
}
export interface UserProfileCreate {
  username: string;
  password: string;
  role?: string;
  email?: string | null;
  phone_number?: string | null;
}

// Employment type
export type EmploymentType = "SALARY" | "COMMISSION";

// Employees
export interface Employee {
  id: number;
  employee_number: string;
  full_name: string;
  position: string;
  department: string | null;
  phone_number: string | null;
  base_salary: string | null;
  employment_type: EmploymentType;
  hired_at: string;
  terminated_at: string | null;
  user_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface EmployeeCreate {
  employee_number: string;
  full_name: string;
  position: string;
  department?: string | null;
  phone_number?: string | null;
  base_salary?: number | null;
  employment_type: EmploymentType;
  hired_at: string;
  user_id?: number | null;
  user_profile?: UserProfileCreate | null;
}
export interface EmployeeUpdate {
  full_name?: string;
  position?: string;
  department?: string | null;
  phone_number?: string | null;
  base_salary?: number;
  employment_type?: EmploymentType;
  terminated_at?: string | null;
  user_id?: number | null;
}
export interface EmployeeList {
  items: Employee[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// SubDivision
export interface SubDivisionMember {
  id: number;
  subdivision_id: number;
  employee_id: number;
  employee_name?: string;
  created_at: string;
}
export interface SubDivision {
  id: number;
  name: string;
  description: string | null;
  members: SubDivisionMember[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface SubDivisionCreate { name: string; description?: string | null; }
export interface SubDivisionUpdate { name?: string; description?: string | null; }
export interface SubDivisionList { items: SubDivision[]; total: number; page: number; size: number; pages: number; }

// Commission rates
export interface CommissionRate {
  id: number;
  product_id: number;
  rate_per_unit: string; // 4 decimal places
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}
export interface CommissionRateCreate { rate_per_unit: number; effective_from: string; effective_to?: string | null; }
export interface CommissionRateUpdate { rate_per_unit?: number; effective_from?: string; effective_to?: string | null; }

// Payroll
export type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";
export interface CommissionLine {
  batch_id: number;
  subdivision_id: number;
  product_id: number;
  batch_quantity: number;
  present_count: number;
  quantity_share: string;
  rate_per_unit: string;
  amount: number;
}
export interface Payslip {
  id: number;
  employee_id: number;
  employee_name?: string;
  base_salary: number;
  commission_amount: number;
  total_amount: number;
  commission_lines?: CommissionLine[];
}
export interface PayrollResponse {
  id: number;
  period_start: string;
  period_end: string;
  status: PayrollStatus;
  generated_by_id: number;
  approved_by_id: number | null;
  total_amount: number;
  payslip_count: number;
  payslips?: Payslip[];
}
export interface PayrollList { items: PayrollResponse[]; total: number; page: number; size: number; pages: number; }
