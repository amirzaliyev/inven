import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import BatchesPage from "./pages/BatchesPage";
import InventoryTransactionsPage from "./pages/InventoryTransactionsPage";
import CustomersPage from "./pages/CustomersPage";
import OrdersPage from "./pages/OrdersPage";
import UsersPage from "./pages/UsersPage";
import EmployeesPage from "./pages/EmployeesPage";
import SubdivisionsPage from "./pages/SubdivisionsPage";
import PayrollPage from "./pages/PayrollPage";
import NotFoundPage from "./pages/NotFoundPage";
import { ToastProvider } from "./contexts/ToastContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";

export default function App() {
  return (
    <ToastProvider>
    <ConfirmProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/batches" element={<BatchesPage />} />
          <Route path="/transactions" element={<InventoryTransactionsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/subdivisions" element={<SubdivisionsPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </ConfirmProvider>
    </ToastProvider>
  );
}
