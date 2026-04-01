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
export enum TransactionType {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT",
}

export enum SourceType {
  SALES = "SALES",
  DEFECT = "DEFECT",
  BATCH = "BATCH",
}

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

// Errors
export interface ApiError {
  code: string;
  message: string;
}
