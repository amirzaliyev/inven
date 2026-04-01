import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import BatchesPage from "./pages/BatchesPage";
import InventoryTransactionsPage from "./pages/InventoryTransactionsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/batches" element={<BatchesPage />} />
          <Route path="/transactions" element={<InventoryTransactionsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
