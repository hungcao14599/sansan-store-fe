import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/app-shell';
import { AuthGuard } from './components/auth-guard';
import { DashboardPage } from './pages/dashboard-page';
import { InventoryPage } from './pages/inventory-page';
import { LoginPage } from './pages/login-page';
import { OrdersPage } from './pages/orders-page';
import { PosPage } from './pages/pos-page';
import { ProductsPage } from './pages/products-page';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/pricebook" element={<Navigate to="/inventory" replace />} />
        <Route path="/invoices" element={<OrdersPage />} />
        <Route path="/orders" element={<Navigate to="/invoices" replace />} />
      </Route>
    </Routes>
  );
}
