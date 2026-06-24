import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ShoppingCart, Truck, TrendingUp, Package, Banknote, Wallet, HandCoins, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import StatCard from '../components/StatCard';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { fetchTodayStats, fetchTodayCost, fetchLast7DaysStats, fetchStatsRange, fetchCostRange, dayId } from '../services/statsService';
import { fetchFinances } from '../services/financeService';
import { fetchLowStockMedicines, fetchExpiringMedicines, fetchAllMedicinesForValuation } from '../services/medicineService';
import { fetchTotalUnpaidDebt } from '../services/debtService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, isManager } = useAuth();
  const navigate = useNavigate();
  const currency = t('common.currency');

  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({ totalSales: 0, saleCount: 0, totalPurchases: 0, totalExpenses: 0 });
  const [todayCost, setTodayCost] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [monthCost, setMonthCost] = useState(0);
  const [finances, setFinances] = useState({ cash: 0, balances: {} });
  const [inventoryValue, setInventoryValue] = useState(0);
  const [unpaidDebt, setUnpaidDebt] = useState(0);
  const [lowStock, setLowStock] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const monthStart = new Date();
      monthStart.setDate(1);

      const tasks = [
        fetchTodayStats(),
        fetchLast7DaysStats(),
        fetchStatsRange(monthStart, new Date()),
        fetchLowStockMedicines(),
        fetchExpiringMedicines(30),
        fetchTotalUnpaidDebt(),
      ];
      const [todayStats, trendRows, monthRows, low, exp, debt] = await Promise.all(tasks);
      if (!active) return;
      setToday(todayStats);
      setTrend(trendRows);
      setMonthSales(monthRows.reduce((a, r) => a + r.totalSales, 0));
      setLowStock(low);
      setExpiring(exp);
      setUnpaidDebt(debt);

      if (isManager) {
        const [cost, monthCostRows, fin, meds] = await Promise.all([
          fetchTodayCost(),
          fetchCostRange(monthStart, new Date()),
          fetchFinances(),
          fetchAllMedicinesForValuation(),
        ]);
        if (!active) return;
        setTodayCost(cost);
        setMonthCost(monthCostRows.reduce((a, r) => a + r.totalCostOfGoods, 0));
        setFinances(fin);
        setInventoryValue(meds.reduce((a, m) => a + (m.quantity || 0) * (m.costPrice || 0), 0));
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [isManager]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const totalLiquidity = finances.cash + Object.values(finances.balances || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">مرحباً بكم في صيدلية السيادة-الفلوجة</h1>
        <p className="text-sm text-sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/sales')}>
          <ShoppingCart size={16} /> {t('dashboard.newSale')}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/purchases')}>
          <Truck size={16} /> {t('dashboard.newPurchase')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} tone="primary" label={t('dashboard.dailySales')} value={money(today.totalSales, currency)} sub={`${today.saleCount} ${t('dashboard.operationsToday')}`} />
        <StatCard icon={TrendingUp} tone="soft" label={t('dashboard.monthlySales')} value={money(monthSales, currency)} />
        {isManager && <StatCard icon={Banknote} tone="accent" label={t('dashboard.dailyProfit')} value={money(today.totalSales - todayCost, currency)} />}
        {isManager && <StatCard icon={TrendingUp} tone="soft" label={t('dashboard.monthlyProfit')} value={money(monthSales - monthCost, currency)} />}
        {isManager && <StatCard icon={Wallet} tone="soft" label={t('dashboard.cashBalance')} value={money(finances.cash, currency)} />}
        {isManager && <StatCard icon={Wallet} tone="soft" label={t('dashboard.totalLiquidity')} value={money(totalLiquidity, currency)} />}
        {isManager && <StatCard icon={Package} tone="soft" label={t('dashboard.inventoryValue')} value={money(inventoryValue, currency)} />}
        <StatCard icon={HandCoins} tone="danger" label={t('dashboard.totalDebts')} value={money(unpaidDebt, currency)} />
      </div>

      <Card className="p-5">
        <h2 className="font-bold text-sm text-ink mb-4">{t('dashboard.salesTrend')}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4EBE8" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => money(v, currency)} />
            <Line type="monotone" dataKey="totalSales" stroke="#0E7C66" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-bold text-sm text-ink mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-accent" /> {t('dashboard.lowStockAlerts')} <Badge tone="accent">{lowStock.length}</Badge>
          </h2>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {lowStock.length === 0 && <p className="text-xs text-sub py-4 text-center">{t('common.noResults')}</p>}
            {lowStock.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs px-2 py-2 rounded-lg hover:bg-bg cursor-pointer" onClick={() => navigate('/medicines')}>
                <span className="font-semibold text-ink">{m.name}</span>
                <Badge tone="accent">{m.quantity}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-sm text-ink mb-3 flex items-center gap-2">
            <Clock size={16} className="text-danger" /> {t('dashboard.expiryAlerts')} <Badge tone="danger">{expiring.length}</Badge>
          </h2>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {expiring.length === 0 && <p className="text-xs text-sub py-4 text-center">{t('common.noResults')}</p>}
            {expiring.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs px-2 py-2 rounded-lg hover:bg-bg cursor-pointer" onClick={() => navigate('/medicines')}>
                <span className="font-semibold text-ink">{m.name}</span>
                <Badge tone="danger">{m.expiryDate?.toDate().toLocaleDateString()}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
