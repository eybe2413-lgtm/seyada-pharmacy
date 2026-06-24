import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { db } from '../lib/firebase';
import { Button, Card, Spinner } from '../components/ui';
import { fetchStatsRange, fetchCostRange } from '../services/statsService';
import { fetchSalariesForMonth } from '../services/salaryService';
import { fetchFinances, fetchWallets } from '../services/financeService';
import { fetchAllMedicinesForValuation } from '../services/medicineService';
import { fetchTotalUnpaidDebt } from '../services/debtService';
import { fetchSalesByDateRange } from '../services/salesService';
import { exportToExcel, printReportPdf } from '../services/exportService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}

function getRange(periodType, anchor) {
  if (periodType === 'daily') {
    const start = new Date(anchor + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (periodType === 'monthly') {
    const [y, m] = anchor.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start, end };
  }
  const y = Number(anchor);
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
}

async function fetchSalariesPaidInYear(year) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const rows = await Promise.all(months.map((m) => fetchSalariesForMonth(m)));
  return rows.flat().reduce((a, s) => a + (s.paidAmount || 0), 0);
}

async function fetchDebtsCreatedInRange(start, end) {
  const snap = await getDocs(query(collection(db, 'debts'), where('date', '>=', start), where('date', '<', end)));
  return snap.docs.reduce((a, d) => a + (d.data().originalAmount || d.data().amount || 0), 0);
}

// Sales documents store their line items inline, so "top sellers" for a
// period is computed by aggregating those items client-side rather than
// from a separate counter. fetchSalesByDateRange caps at 500 sales, which
// is an acceptable bound for a single report run (not a live dashboard).
function aggregateTopSellers(sales, topN = 10) {
  const byMedicine = new Map();
  sales.forEach((s) => {
    (s.items || []).forEach((i) => {
      const entry = byMedicine.get(i.medicineId) || { name: i.name, qty: 0, revenue: 0 };
      entry.qty += i.qty;
      entry.revenue += i.qty * i.price;
      byMedicine.set(i.medicineId, entry);
    });
  });
  return Array.from(byMedicine.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, topN);
}

export default function Reports() {
  const { t, i18n } = useTranslation();
  const currency = t('common.currency');
  const today = new Date();

  const [periodType, setPeriodType] = useState('monthly');
  const [anchor, setAnchor] = useState(today.toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    // Reset anchor to a sensible default whenever the period type changes.
    if (periodType === 'daily') setAnchor(today.toISOString().slice(0, 10));
    if (periodType === 'monthly') setAnchor(today.toISOString().slice(0, 7));
    if (periodType === 'yearly') setAnchor(String(today.getFullYear()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType]);

  const load = useCallback(async () => {
    if (!anchor) return;
    setLoading(true);
    const { start, end } = getRange(periodType, anchor);

    const [statsRows, costRows, finances, wallets, medicines, unpaidDebt, debtsCreated, periodSales] = await Promise.all([
      fetchStatsRange(start, new Date(end.getTime() - 1)),
      fetchCostRange(start, new Date(end.getTime() - 1)),
      fetchFinances(),
      fetchWallets(),
      fetchAllMedicinesForValuation(),
      fetchTotalUnpaidDebt(),
      fetchDebtsCreatedInRange(start, end),
      fetchSalesByDateRange(start, end),
    ]);

    const totalSales = statsRows.reduce((a, r) => a + r.totalSales, 0);
    const totalPurchases = statsRows.reduce((a, r) => a + r.totalPurchases, 0);
    const totalExpenses = statsRows.reduce((a, r) => a + r.totalExpenses, 0);
    const totalCost = costRows.reduce((a, r) => a + r.totalCostOfGoods, 0);
    const saleCount = statsRows.reduce((a, r) => a + r.saleCount, 0);

    let totalSalaries = 0;
    if (periodType === 'daily' || periodType === 'monthly') {
      const month = periodType === 'daily' ? anchor.slice(0, 7) : anchor;
      const rows = await fetchSalariesForMonth(month);
      totalSalaries = rows.reduce((a, s) => a + (s.paidAmount || 0), 0);
    } else {
      totalSalaries = await fetchSalariesPaidInYear(anchor);
    }

    const inventoryValue = medicines.reduce((a, m) => a + (m.quantity || 0) * (m.costPrice || 0), 0);
    const lowStockCount = medicines.filter((m) => m.isLowStock).length;
    const expiredCount = medicines.filter((m) => m.expiryDate && m.expiryDate.toDate() < new Date()).length;
    const totalLiquidity = finances.cash + Object.values(finances.balances || {}).reduce((a, b) => a + b, 0);

    setData({
      totalSales,
      saleCount,
      totalPurchases,
      totalExpenses,
      totalCost,
      profit: totalSales - totalCost,
      totalSalaries,
      debtsCreated,
      unpaidDebt,
      inventoryValue,
      lowStockCount,
      expiredCount,
      cash: finances.cash,
      balances: finances.balances || {},
      walletNames: Object.fromEntries(wallets.map((w) => [w.id, w.name])),
      totalLiquidity,
      topSellers: aggregateTopSellers(periodSales),
    });
    setLoading(false);
  }, [periodType, anchor]);

  useEffect(() => {
    load();
  }, [load]);

  function buildRows() {
    if (!data) return [];
    return [
      { label: t('reports.salesReport') + ' — ' + t('common.total'), value: money(data.totalSales, currency) },
      { label: t('dashboard.operationsToday'), value: data.saleCount },
      { label: t('reports.profitReport'), value: money(data.profit, currency) },
      { label: t('purchases.title'), value: money(data.totalPurchases, currency) },
      { label: t('expenses.title'), value: money(data.totalExpenses, currency) },
      { label: t('salaries.title'), value: money(data.totalSalaries, currency) },
      { label: t('debts.title') + ' (' + t('common.thisMonth') + ')', value: money(data.debtsCreated, currency) },
      { label: t('dashboard.totalDebts') + ' (' + t('common.all') + ')', value: money(data.unpaidDebt, currency) },
      { label: t('dashboard.inventoryValue'), value: money(data.inventoryValue, currency) },
      { label: t('medicines.lowStock'), value: data.lowStockCount },
      { label: t('medicines.expired'), value: data.expiredCount },
      { label: t('wallets.cashBalance'), value: money(data.cash, currency) },
      { label: t('wallets.totalLiquidity'), value: money(data.totalLiquidity, currency) },
    ];
  }

  function handleExportExcel() {
    exportToExcel(`seyada-report-${anchor}`, buildRows().map((r) => ({ [t('reports.title')]: r.label, ' ': r.value })));
  }
  function handleExportPdf() {
    printReportPdf({
      title: `${t('reports.title')} — ${anchor}`,
      rows: buildRows(),
      lang: i18n.language,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink">{t('reports.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet size={16} /> {t('reports.exportExcel')}
          </Button>
          <Button variant="outline" onClick={handleExportPdf}>
            <FileDown size={16} /> {t('reports.exportPdf')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {['daily', 'monthly', 'yearly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriodType(p)}
              className={`px-3 py-2 rounded-lg text-xs font-bold ${periodType === p ? 'bg-primary text-white' : 'bg-white border border-line text-sub'}`}
            >
              {t('reports.' + p)}
            </button>
          ))}
        </div>
        <input
          type={periodType === 'daily' ? 'date' : periodType === 'monthly' ? 'month' : 'number'}
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />
      </div>

      {loading || !data ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric label={t('dashboard.dailySales')} value={money(data.totalSales, currency)} tone="primary" />
          <Metric label={t('reports.profitReport')} value={money(data.profit, currency)} tone="accent" />
          <Metric label={t('purchases.title')} value={money(data.totalPurchases, currency)} />
          <Metric label={t('expenses.title')} value={money(data.totalExpenses, currency)} />
          <Metric label={t('salaries.title')} value={money(data.totalSalaries, currency)} />
          <Metric label={t('dashboard.totalDebts')} value={money(data.unpaidDebt, currency)} tone="danger" />
          <Metric label={t('dashboard.inventoryValue')} value={money(data.inventoryValue, currency)} />
          <Metric label={t('wallets.totalLiquidity')} value={money(data.totalLiquidity, currency)} />
          <Metric label={t('wallets.cashBalance')} value={money(data.cash, currency)} tone='primary' />
          <Metric label='مجموع المحافظ' value={money(Object.values(data.balances || {}).reduce((a, b) => a + b, 0), currency)} tone='primary' />
        </div>
      )}

      {data && data.topSellers.length > 0 && (
        <Card className="p-5">
          <h2 className="font-bold text-sm text-ink mb-3">{t('reports.topSelling')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-sub text-xs">
                <tr>
                  <th className="text-start py-2 font-bold">{t('medicines.medicineName')}</th>
                  <th className="text-start py-2 font-bold">{t('reports.unitsSold')}</th>
                  <th className="text-start py-2 font-bold">{t('common.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {data.topSellers.map((s, idx) => (
                  <tr key={idx} className="border-t border-line">
                    <td className="py-2.5 font-semibold text-ink">{s.name}</td>
                    <td className="py-2.5">{s.qty}</td>
                    <td className="py-2.5 text-sub">{money(s.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data && (
        <Card className="p-5">
          <h2 className="font-bold text-sm text-ink mb-3">{t('wallets.title')}</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="flex justify-between p-3 bg-bg rounded-lg">
              <span className="text-sub">{t('wallets.cashBalance')}</span>
              <span className="font-bold">{money(data.cash, currency)}</span>
            </div>
            {Object.entries(data.balances).map(([id, val]) => (
              <div key={id} className="flex justify-between p-3 bg-bg rounded-lg">
                <span className="text-sub">{data.walletNames[id] || id}</span>
                <span className="font-bold">{money(val, currency)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'soft' }) {
  const tones = { primary: 'bg-primary text-white', accent: 'bg-accent text-white', danger: 'bg-danger text-white', soft: 'bg-white border border-line text-ink' };
  return (
    <div className={`rounded-xl2 p-4 ${tones[tone]}`}>
      <div className={`text-[11px] font-semibold mb-1 ${tone === 'soft' ? 'text-sub' : 'text-white/80'}`}>{label}</div>
      <div className="text-lg font-extrabold">{value}</div>
    </div>
  );
}
