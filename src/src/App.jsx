import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Medicines from './pages/Medicines';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Debts from './pages/Debts';
import Wallets from './pages/Wallets';
import Expenses from './pages/Expenses';
import Salaries from './pages/Salaries';
import Reports from './pages/Reports';
import ImportMedicines from './pages/ImportMedicines';
import StockTake from './pages/StockTake';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Accounts from './pages/Accounts';
import Users from './pages/Users';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';

function Shell({ children, managerOnly = false }) {
  return (
    <ProtectedRoute managerOnly={managerOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Shell><Dashboard /></Shell>} />
      <Route path="/medicines" element={<Shell><Medicines /></Shell>} />
      <Route path="/sales" element={<Shell><Sales /></Shell>} />
      <Route path="/purchases" element={<Shell><Purchases /></Shell>} />
      <Route path="/debts" element={<Shell><Debts /></Shell>} />
      <Route path="/customers" element={<Shell><Customers /></Shell>} />
      <Route path="/suppliers" element={<Shell><Suppliers /></Shell>} />
      <Route path="/stock-take" element={<Shell><StockTake /></Shell>} />
      <Route path="/wallets" element={<Shell managerOnly><Wallets /></Shell>} />
      <Route path="/expenses" element={<Shell><Expenses /></Shell>} />
      <Route path="/salaries" element={<Shell managerOnly><Salaries /></Shell>} />
      <Route path="/reports" element={<Shell managerOnly><Reports /></Shell>} />
      <Route path="/accounts" element={<Shell managerOnly><Accounts /></Shell>} />
      <Route path="/import-medicines" element={<Shell><ImportMedicines /></Shell>} />
      <Route path="/users" element={<Shell managerOnly><Users /></Shell>} />
      <Route path="/audit-log" element={<Shell><AuditLog /></Shell>} />
      <Route path="/settings" element={<Shell><Settings /></Shell>} />
    </Routes>
  );
}
