import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  FileSpreadsheet, Printer, BarChart3, ShoppingCart,
  Receipt, ChevronDown, Wallet, Banknote,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button, Card, Spinner, Badge, EmptyState } from '../components/ui';
import { fetchSalesByDateRange } from '../services/salesService';
import { fetchExpensesByDateRange } from '../services/expenseService';
import { fetchAllMedicinesForValuation } from '../services/medicineService';
import { fetchWallets, subscribeFinances } from '../services/financeService';
import { printReportPdf } from '../services/exportService';

// ── Constants ──────────────────────────────────────────────────────────────

const PERIODS = ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'thisYear', 'custom'];

const EXPENSE_CAT_AR = {
  electricity: 'كهرباء', water: 'ماء', internet: 'إنترنت',
  breakfast: 'فطور', lunch: 'غداء', taxi: 'تاكسي',
  maintenance: 'صيانة', other: 'أخرى',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getPeriodDates(period, customFrom, customTo) {
  const now = new Date();
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const eod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  switch (period) {
    case 'today':      return [sod(now), eod(now)];
    case 'thisWeek': { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); return [sod(s), eod(now)]; }
    case 'thisMonth':  return [new Date(now.getFullYear(), now.getMonth(), 1), eod(now)];
    case 'lastMonth':  return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
    case 'thisYear':   return [new Date(now.getFullYear(), 0, 1), eod(now)];
    case 'custom': {
      const s = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
      const e = customTo ? new Date(new Date(customTo).getTime() + 86400000) : eod(now);
      return [s, e];
    }
    default: return [new Date(now.getFullYear(), now.getMonth(), 1), eod(now)];
  }
}

function fmt(n, currency) {
  return Number(n || 0).toLocaleString('en-US') + ' ' + currency;
}

function pct(num, denom) {
  if (!denom) return '0%';
  return ((num / denom) * 100).toFixed(1) + '%';
}

function payLabel(paymentMethod, wallets) {
  if (paymentMethod === 'cash') return 'نقداً';
  if (paymentMethod === 'debt') return 'آجل';
  return wallets.find((w) => w.id === paymentMethod)?.name || paymentMethod;
}

// ── Multi-sheet Excel export ────────────────────────────────────────────────

function exportAccountsExcel({ salesRows, expRows, invRows, summaryRows, filename }) {
  const wb = XLSX.utils.book_new();

  const addSheet = (name, rows) => {
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet('ملخص', summaryRows);
  addSheet('مبيعات', salesRows);
  addSheet('نفقات', expRows);
  addSheet('مخزون', invRows);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ══════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════

export default function Accounts() {
  const { t, i18n } = useTranslation();
  const currency = t('common.currency');

  const [period, setPeriod]       = useState('thisMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [tab, setTab]             = useState('summary');
  const [loading, setLoading]     = useState(false);
  const [data, setData]           = useState(null);
  const [finances, setFinances]   = useState({ cash: 0, balances: {} });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [start, end] = getPeriodDates(period, customFrom, customTo);
      const [sales, expenses, medicines, wallets] = await Promise.all([
        fetchSalesByDateRange(start, end),
        fetchExpensesByDateRange(start, end),
        fetchAllMedicinesForValuation(),
        fetchWallets(),
      ]);

      // Sales
      const totalRevenue  = sales.reduce((a, s) => a + (s.total || 0), 0);
      const totalSubtotal = sales.reduce((a, s) => a + (s.subtotal || s.total || 0), 0);
      const totalDiscount = sales.reduce((a, s) => a + (s.discount || 0), 0);
      const cashSales   = sales.filter((s) => s.paymentMethod === 'cash').reduce((a, s) => a + (s.total || 0), 0);
      const debtSales   = sales.filter((s) => s.paymentMethod === 'debt').reduce((a, s) => a + (s.total || 0), 0);
      const walletSales = totalRevenue - cashSales - debtSales;

      // Top medicines
      const medMap = new Map();
      sales.forEach((s) => (s.items || []).forEach((i) => {
        const e = medMap.get(i.medicineId) || { name: i.name, qty: 0, revenue: 0 };
        e.qty += i.qty; e.revenue += i.qty * i.price;
        medMap.set(i.medicineId, e);
      }));
      const topSellers = [...medMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      // Expenses
      const totalExpenses = expenses.reduce((a, e) => a + (e.amount || 0), 0);
      const expByCategory = {};
      expenses.forEach((e) => { expByCategory[e.category] = (expByCategory[e.category] || 0) + e.amount; });

      // Inventory
      const inventoryCostValue = medicines.reduce((a, m) => a + (m.costPrice || 0) * (m.quantity || 0), 0);
      const inventorySellValue = medicines.reduce((a, m) => a + (m.sellPrice || 0) * (m.quantity || 0), 0);

      setData({
        start, end, sales, expenses, medicines, wallets,
        totalRevenue, totalSubtotal, totalDiscount,
        cashSales, debtSales, walletSales,
        totalExpenses, expByCategory,
        inventoryCostValue, inventorySellValue,
        netProfit: totalRevenue - totalExpenses,
        topSellers,
      });
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  React.useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = subscribeFinances(setFinances);
    return () => unsub();
  }, []);

  // ── Excel export (3 sheets: ملخص + مبيعات + نفقات + مخزون) ─────────────

  function handleExcelExport() {
    if (!data) return;

    const summaryRows = [
      { البيان: t('accounts.totalRevenue'),  القيمة: data.totalRevenue,  العملة: currency },
      { البيان: t('accounts.totalDiscount'), القيمة: data.totalDiscount, العملة: currency },
      { البيان: t('accounts.totalExpenses'), القيمة: data.totalExpenses, العملة: currency },
      { البيان: t('accounts.netProfit'),     القيمة: data.netProfit,     العملة: currency },
      { البيان: 'هامش الربح %',             القيمة: pct(data.netProfit, data.totalRevenue), العملة: '' },
      { البيان: 'قيمة المخزون (تكلفة)',     القيمة: data.inventoryCostValue, العملة: currency },
      { البيان: 'قيمة المخزون (بيع)',       القيمة: data.inventorySellValue, العملة: currency },
    ];

    const salesRows = data.sales.map((s) => ({
      التاريخ:       s.date?.toDate().toLocaleString() || '',
      'عدد الأصناف': (s.items || []).length,
      'المجموع الفرعي': s.subtotal || s.total,
      الخصم:         s.discount || 0,
      الإجمالي:      s.total,
      'طريقة الدفع': payLabel(s.paymentMethod, data.wallets),
      العميل:        s.customerName || '',
      البائع:        s.soldByName || '',
    }));

    const expRows = data.expenses.map((e) => ({
      التاريخ:  e.date?.toDate().toLocaleString() || '',
      الفئة:   EXPENSE_CAT_AR[e.category] || e.category,
      المبلغ:  e.amount,
      الوصف:   e.description || '',
      المصدر:  e.paymentSource === 'cash' ? 'نقداً' : e.paymentSource,
    }));

    const invRows = data.medicines
      .slice()
      .sort((a, b) => (b.costPrice || 0) * (b.quantity || 0) - (a.costPrice || 0) * (a.quantity || 0))
      .map((m) => ({
        الدواء:           m.name,
        الكمية:          m.quantity,
        'سعر الشراء':    m.costPrice || 0,
        'سعر البيع':     m.sellPrice || 0,
        'قيمة المخزون':  (m.costPrice || 0) * (m.quantity || 0),
        'قيمة البيع':    (m.sellPrice || 0) * (m.quantity || 0),
      }));

    exportAccountsExcel({
      summaryRows,
      salesRows,
      expRows,
      invRows,
      filename: `seyada-accounts-${new Date().toISOString().slice(0, 10)}`,
    });
  }

  // ── PDF print ──────────────────────────────────────────────────────────

  function handlePrint() {
    if (!data) return;
    printReportPdf({
      title: t('accounts.title'),
      rows: [
        { label: t('accounts.totalRevenue'),  value: fmt(data.totalRevenue, currency) },
        { label: t('accounts.totalDiscount'), value: fmt(data.totalDiscount, currency) },
        { label: t('accounts.totalExpenses'), value: fmt(data.totalExpenses, currency) },
        { label: t('accounts.netProfit'),     value: fmt(data.netProfit, currency) },
        { label: 'هامش الربح', value: pct(data.netProfit, data.totalRevenue) },
        { label: t('accounts.salesCount'),    value: String(data.sales.length) },
        { label: t('accounts.totalMedicines'), value: String(data.medicines.length) },
        { label: 'قيمة المخزون (تكلفة)', value: fmt(data.inventoryCostValue, currency) },
        { label: 'قيمة المخزون (بيع)',   value: fmt(data.inventorySellValue, currency) },
      ],
      lang: i18n.language,
    });
  }

  // ── Tabs ───────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'summary',   label: t('accounts.summaryTab'),   icon: BarChart3 },
    { id: 'sales',     label: t('accounts.salesTab'),     icon: ShoppingCart },
    { id: 'expenses',  label: t('accounts.expensesTab'),  icon: Receipt },
    { id: 'inventory', label: t('accounts.inventoryTab'), icon: Package },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">{t('accounts.title')}</h1>
          <p className="text-xs text-sub mt-0.5">{t('accounts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExcelExport} disabled={!data}>
            <FileSpreadsheet size={15} /> {t('accounts.exportExcel')}
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!data}>
            <Printer size={15} /> {t('accounts.printPdf')}
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIODS.filter((p) => p !== 'custom').map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                ${period === p ? 'bg-primary text-white' : 'bg-bg text-ink hover:bg-primary-soft'}`}
            >
              {t(`accounts.${p}`)}
            </button>
          ))}
          <button
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1
              ${period === 'custom' ? 'bg-primary text-white' : 'bg-bg text-ink'}`}
          >
            <ChevronDown size={12} /> {t('accounts.custom')}
          </button>
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-[11px] text-sub mb-1">{t('accounts.from')}</p>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-line rounded-lg px-3 py-2 text-sm bg-bg font-semibold" />
            </div>
            <div>
              <p className="text-[11px] text-sub mb-1">{t('accounts.to')}</p>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="border border-line rounded-lg px-3 py-2 text-sm bg-bg font-semibold" />
            </div>
            <Button onClick={load} disabled={loading}>
              {loading ? <Spinner className="text-white" /> : t('accounts.apply')}
            </Button>
          </div>
        )}
      </Card>

      {/* Loading */}
      {loading && <div className="flex justify-center py-16"><Spinner /></div>}

      {/* Data */}
      {data && !loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="مجموع المحافظ" value={fmt(Object.values(finances.balances || {}).reduce((a, b) => a + b, 0), currency)} color="primary" icon={Wallet} />
            <KpiCard label="الرصيد النقدي" value={fmt(finances.cash, currency)} color="accent" icon={Banknote} />
            <KpiCard label={t('accounts.inventoryValue')} value={fmt(data.inventoryCostValue, currency)}
              sub={`${data.medicines.length} صنف`} color="default" icon={Package} />
          </div>

          {/* Tabs bar */}
          <div className="flex gap-1 bg-bg rounded-xl p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors
                  ${tab === id ? 'bg-white text-primary shadow-sm' : 'text-sub hover:text-ink'}`}>
                <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* ── SUMMARY TAB ── */}
          {tab === 'summary' && (
            <div className="space-y-4">
              {/* Payment breakdown */}
              <div className="grid sm:grid-cols-3 gap-3">
                <MiniCard label={t('accounts.cashSales')}   value={fmt(data.cashSales, currency)}   color="primary" />
                <MiniCard label={t('accounts.walletSales')} value={fmt(data.walletSales, currency)} color="accent" />
                <MiniCard label={t('accounts.debtSales')}   value={fmt(data.debtSales, currency)}   color="danger" />
              </div>

              {/* Top sellers */}
              {data.topSellers.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="px-4 pt-4 pb-2 font-bold text-sm text-ink">🏆 {t('reports.topSelling')}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-bg text-xs text-sub">
                        <tr>
                          <th className="text-start px-4 py-2 font-bold">#</th>
                          <th className="text-start px-4 py-2 font-bold">{t('medicines.medicineName')}</th>
                          <th className="text-start px-4 py-2 font-bold">{t('reports.unitsSold')}</th>
                          <th className="text-start px-4 py-2 font-bold">{t('common.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topSellers.map((s, i) => (
                          <tr key={i} className="border-t border-line">
                            <td className="px-4 py-2.5 text-sub font-bold">{i + 1}</td>
                            <td className="px-4 py-2.5 font-semibold text-ink">{s.name}</td>
                            <td className="px-4 py-2.5"><Badge tone="primary">{s.qty}</Badge></td>
                            <td className="px-4 py-2.5 text-sub">{fmt(s.revenue, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Expenses by category */}
              {Object.keys(data.expByCategory).length > 0 && (
                <Card className="overflow-hidden">
                  <div className="px-4 pt-4 pb-2 font-bold text-sm text-ink">📊 {t('accounts.expensesByCategory')}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-bg text-xs text-sub">
                        <tr>
                          <th className="text-start px-4 py-2 font-bold">{t('accounts.category')}</th>
                          <th className="text-start px-4 py-2 font-bold">{t('common.amount')}</th>
                          <th className="text-start px-4 py-2 font-bold">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.expByCategory)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cat, amt]) => (
                          <tr key={cat} className="border-t border-line">
                            <td className="px-4 py-2.5 font-semibold">{EXPENSE_CAT_AR[cat] || cat}</td>
                            <td className="px-4 py-2.5">{fmt(amt, currency)}</td>
                            <td className="px-4 py-2.5 text-sub">{pct(amt, data.totalExpenses)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-primary bg-primary-soft">
                          <td className="px-4 py-3 font-bold text-primary">{t('common.total')}</td>
                          <td className="px-4 py-3 font-bold text-primary">{fmt(data.totalExpenses, currency)}</td>
                          <td className="px-4 py-3 font-bold text-primary">100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── SALES TAB ── */}
          {tab === 'sales' && (
            <Card className="overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <span className="font-bold text-sm text-ink">{t('accounts.salesDetails')}</span>
                <Badge tone="primary">{data.sales.length} فاتورة · {fmt(data.totalRevenue, currency)}</Badge>
              </div>
              <div className="overflow-x-auto">
                {data.sales.length === 0
                  ? <EmptyState>{t('accounts.noSales')}</EmptyState>
                  : (
                  <table className="w-full text-sm">
                    <thead className="bg-bg text-xs text-sub">
                      <tr>
                        <th className="text-start px-4 py-2 font-bold">{t('common.date')}</th>
                        <th className="text-start px-4 py-2 font-bold hidden md:table-cell">أصناف</th>
                        <th className="text-start px-4 py-2 font-bold hidden sm:table-cell">{t('sales.subtotal')}</th>
                        <th className="text-start px-4 py-2 font-bold hidden sm:table-cell">{t('sales.discount')}</th>
                        <th className="text-start px-4 py-2 font-bold">{t('common.total')}</th>
                        <th className="text-start px-4 py-2 font-bold hidden lg:table-cell">{t('sales.paymentMethod')}</th>
                        <th className="text-start px-4 py-2 font-bold hidden lg:table-cell">{t('sales.customer')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales.map((s, i) => (
                        <tr key={s.id || i} className="border-t border-line hover:bg-bg/60">
                          <td className="px-4 py-2.5 text-sub text-xs">{s.date?.toDate().toLocaleString()}</td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <Badge tone="default">{(s.items || []).length}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-sub hidden sm:table-cell">{fmt(s.subtotal || s.total, currency)}</td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            {(s.discount > 0) && <span className="text-danger text-xs font-semibold">−{fmt(s.discount, currency)}</span>}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-ink">{fmt(s.total, currency)}</td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <Badge tone={s.paymentMethod === 'debt' ? 'danger' : s.paymentMethod === 'cash' ? 'primary' : 'accent'}>
                              {payLabel(s.paymentMethod, data.wallets)}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-sub text-xs">{s.customerName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-primary-soft">
                      <tr>
                        <td className="px-4 py-3 font-bold text-primary" colSpan={2}>{t('common.total')}</td>
                        <td className="px-4 py-3 font-bold text-sub hidden sm:table-cell">{fmt(data.totalSubtotal, currency)}</td>
                        <td className="px-4 py-3 font-bold text-danger hidden sm:table-cell">−{fmt(data.totalDiscount, currency)}</td>
                        <td className="px-4 py-3 font-extrabold text-primary text-base">{fmt(data.totalRevenue, currency)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </Card>
          )}

          {/* ── EXPENSES TAB ── */}
          {tab === 'expenses' && (
            <Card className="overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <span className="font-bold text-sm text-ink">{t('accounts.expensesDetails')}</span>
                <Badge tone="danger">{data.expenses.length} عملية · {fmt(data.totalExpenses, currency)}</Badge>
              </div>
              <div className="overflow-x-auto">
                {data.expenses.length === 0
                  ? <EmptyState>{t('accounts.noExpenses')}</EmptyState>
                  : (
                  <table className="w-full text-sm">
                    <thead className="bg-bg text-xs text-sub">
                      <tr>
                        <th className="text-start px-4 py-2 font-bold">{t('common.date')}</th>
                        <th className="text-start px-4 py-2 font-bold">{t('accounts.category')}</th>
                        <th className="text-start px-4 py-2 font-bold">{t('common.amount')}</th>
                        <th className="text-start px-4 py-2 font-bold hidden md:table-cell">{t('common.description')}</th>
                        <th className="text-start px-4 py-2 font-bold hidden lg:table-cell">{t('expenses.source')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenses.map((e, i) => (
                        <tr key={e.id || i} className="border-t border-line hover:bg-bg/60">
                          <td className="px-4 py-2.5 text-sub text-xs">{e.date?.toDate().toLocaleString()}</td>
                          <td className="px-4 py-2.5">
                            <Badge tone="accent">{EXPENSE_CAT_AR[e.category] || e.category}</Badge>
                          </td>
                          <td className="px-4 py-2.5 font-bold text-danger">{fmt(e.amount, currency)}</td>
                          <td className="px-4 py-2.5 text-sub hidden md:table-cell">{e.description || '—'}</td>
                          <td className="px-4 py-2.5 text-sub hidden lg:table-cell text-xs">
                            {e.paymentSource === 'cash' ? 'نقداً' : e.paymentSource}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-danger-soft">
                      <tr>
                        <td className="px-4 py-3 font-bold text-danger" colSpan={2}>{t('common.total')}</td>
                        <td className="px-4 py-3 font-extrabold text-danger text-base">{fmt(data.totalExpenses, currency)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </Card>
          )}

          {/* ── INVENTORY TAB ── */}
          {tab === 'inventory' && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <MiniCard label="عدد الأصناف" value={`${data.medicines.length} صنف`} color="default" />
                <MiniCard label="قيمة المخزون (تكلفة)" value={fmt(data.inventoryCostValue, currency)} color="primary" />
                <MiniCard label="قيمة المخزون (بيع)"   value={fmt(data.inventorySellValue, currency)} color="accent" />
              </div>
              <Card className="overflow-hidden">
                <div className="px-4 pt-4 pb-2 font-bold text-sm text-ink">{t('accounts.inventoryDetails')}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-bg text-xs text-sub">
                      <tr>
                        <th className="text-start px-4 py-2 font-bold">{t('medicines.medicineName')}</th>
                        <th className="text-start px-4 py-2 font-bold">{t('medicines.quantity')}</th>
                        <th className="text-start px-4 py-2 font-bold hidden sm:table-cell">{t('medicines.purchasePrice')}</th>
                        <th className="text-start px-4 py-2 font-bold hidden sm:table-cell">{t('medicines.salePrice')}</th>
                        <th className="text-start px-4 py-2 font-bold">{t('accounts.stockValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.medicines
                        .slice()
                        .sort((a, b) => (b.costPrice||0)*(b.quantity||0) - (a.costPrice||0)*(a.quantity||0))
                        .map((m) => (
                        <tr key={m.id} className="border-t border-line hover:bg-bg/60">
                          <td className="px-4 py-2.5 font-semibold text-ink">
                            {m.name}
                            {m.isLowStock && (
                              <span className="ms-2 text-[10px] font-bold text-accent bg-accent-soft px-1.5 py-0.5 rounded-full">⚠ ناقص</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">{m.quantity}</td>
                          <td className="px-4 py-2.5 text-sub hidden sm:table-cell">{m.costPrice || 0}</td>
                          <td className="px-4 py-2.5 text-sub hidden sm:table-cell">{m.sellPrice || 0}</td>
                          <td className="px-4 py-2.5 font-bold">{fmt((m.costPrice||0)*(m.quantity||0), currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-primary-soft">
                      <tr>
                        <td className="px-4 py-3 font-bold text-primary" colSpan={4}>{t('common.total')}</td>
                        <td className="px-4 py-3 font-extrabold text-primary text-base">{fmt(data.inventoryCostValue, currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }) {
  const bg = { primary:'bg-primary text-white', danger:'bg-danger text-white', accent:'bg-accent text-white', default:'bg-white border border-line text-ink' };
  const ic = { primary:'bg-white/20', danger:'bg-white/20', accent:'bg-white/20', default:'bg-bg' };
  return (
    <Card className={`p-4 ${bg[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold opacity-80">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${ic[color]} flex items-center justify-center`}>
          <Icon size={15} className="opacity-80" />
        </div>
      </div>
      <p className="text-xl font-extrabold leading-tight">{value}</p>
      <p className="text-xs mt-1 opacity-70">{sub}</p>
    </Card>
  );
}

function MiniCard({ label, value, color }) {
  const cls = {
    primary:'border-primary/20 bg-primary-soft text-primary-dark',
    accent: 'border-accent/20 bg-accent-soft text-accent',
    danger: 'border-danger/20 bg-danger-soft text-danger',
    default:'border-line bg-white text-ink',
  };
  return (
    <div className={`rounded-xl border p-4 ${cls[color]}`}>
      <p className="text-xs font-semibold opacity-70 mb-1">{label}</p>
      <p className="text-base font-extrabold">{value}</p>
    </div>
  );
}
