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
  quantity: number;
  is_confirmed: boolean;
  created_at: string;
  update_at: string;
  created_by_id: number | null;
  updated_by_id: number | null;
}

export interface BatchCreate {
  batch_date: string;
  product_id: number;
  quantity: number;
}

export interface BatchUpdate {
  batch_date?: string;
  product_id?: number;
  quantity?: number;
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

// Errors
export interface ApiError {
  code: string;
  message: string;
}
