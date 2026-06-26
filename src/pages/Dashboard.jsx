import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ShoppingCart, Truck, TrendingUp, Package, Banknote, Wallet, HandCoins, AlertTriangle, Clock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import StatCard from '../components/StatCard';
import { Card, Button, Badge, Spinner } from '../components/ui';
import { fetchTodayStats, fetchTodayCost, fetchLast7DaysStats, fetchStatsRange, fetchCostRange } from '../services/statsService';
import { fetchFinances } from '../services/financeService';
import { fetchLowStockMedicines, fetchExpiringMedicines, fetchAllMedicinesForValuation } from '../services/medicineService';
import { fetchTotalUnpaidDebt } from '../services/debtService';

const PROFIT_PIN = '2413';

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

  // حالة بطاقة الربح
  const [profitVisible, setProfitVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

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
    return () => { active = false; };
  }, [isManager]);

  function handlePinSubmit() {
    if (pinInput === PROFIT_PIN) {
      setProfitVisible(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const totalLiquidity = finances.cash + Object.values(finances.balances || {}).reduce((a, b) => a + b, 0);
  const todayProfit = today.totalSales - todayCost;
  const monthProfit = monthSales - monthCost;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink">{t('dashboard.welcomeBack')}، {user?.name}</h1>
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

        {/* التعديل ١١: بطاقة الربح الموحدة بكلمة سر */}
        {isManager && (
          <div
            className="col-span-2 rounded-xl2 p-4 bg-white border border-line cursor-pointer"
            onClick={() => !profitVisible && setShowPinModal(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-accent/10">
                  <TrendingUp size={16} className="text-accent" />
                </div>
                <span className="text-xs font-bold text-sub">الربح</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); if (profitVisible) setProfitVisible(false); else setShowPinModal(true); }}
                className="p-1.5 rounded-lg hover:bg-bg text-sub"
              >
                {profitVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {profitVisible ? (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-[11px] text-sub mb-1">ربح اليوم</p>
                  <p className="text-base font-extrabold text-accent">{money(todayProfit, currency)}</p>
                </div>
                <div className="bg-bg rounded-lg p-3">
                  <p className="text-[11px] text-sub mb-1">ربح الشهر</p>
                  <p className="text-base font-extrabold text-accent">{money(monthProfit, currency)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4 gap-2 text-sub">
                <Eye size={18} />
                <span className="text-sm font-semibold">اضغط لعرض الربح</span>
              </div>
            )}
          </div>
        )}

        {isManager && <StatCard icon={Wallet} tone="soft" label={t('dashboard.cashBalance')} value={money(finances.cash, currency)} />}

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

      {/* نافذة إدخال كلمة السر */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Eye size={22} className="text-accent" />
            </div>
            <p className="font-bold text-ink text-base mb-4">أدخل كلمة السر لعرض الربح</p>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              placeholder="••••"
              className="w-full border border-line rounded-xl px-4 py-3 text-center text-lg tracking-widest mb-3 outline-none focus:border-primary"
              autoFocus
            />
            {pinError && <p className="text-xs text-danger mb-3">كلمة السر غير صحيحة</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(false); }} className="flex-1 py-2.5 rounded-xl border border-line text-sm font-bold text-ink">
                إلغاء
              </button>
              <button onClick={handlePinSubmit} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold">
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
