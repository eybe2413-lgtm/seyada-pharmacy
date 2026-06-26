import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Input, Modal, Spinner, EmptyState, LoadMoreButton, Badge } from '../components/ui';
import { fetchWallets } from '../services/financeService';
import { fetchExpensesPage, recordExpense, EXPENSE_CATEGORIES } from '../services/expenseService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}

export default function Expenses() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = t('common.currency');

  const fetchPage = useCallback((cursor) => fetchExpensesPage({ cursor }), []);
  const { items, loading, refresh, hasMore, loadingMore, loadMore } = usePaginatedCollection(fetchPage, []);

  const [wallets, setWallets] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWallets().then(setWallets);
  }, []);

  async function submit() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      await recordExpense({ category: form.category, amount, description: form.description.trim(), paymentSource: form.paymentSource, user });
      setForm(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">{t('expenses.title')}</h1>
        <Button onClick={() => setForm({ category: EXPENSE_CATEGORIES[0], amount: '', description: '', paymentSource: 'cash' })}>
          <Plus size={16} /> {t('expenses.addExpense')}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-sub text-xs">
              <tr>
                <th className="text-start px-4 py-3 font-bold">{t('expenses.category')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('common.amount')}</th>
                <th className="text-start px-4 py-3 font-bold hidden sm:table-cell">{t('common.date')}</th>
                <th className="text-start px-4 py-3 font-bold hidden md:table-cell">{t('expenses.recordedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="py-10 text-center">
                    <Spinner />
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState>{t('common.noResults')}</EmptyState>
                  </td>
                </tr>
              )}
              {items.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Badge>{t('expenses.' + e.category)}</Badge>
                  </td>
                  <td className="px-4 py-3 font-bold text-danger">{money(e.amount, currency)}</td>
                  <td className="px-4 py-3 text-sub hidden sm:table-cell">{e.date?.toDate().toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sub hidden md:table-cell">{e.recordedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={t('expenses.addExpense')}>
        {form && (
          <>
            <Field label={t('expenses.category')}>
              <div className="flex flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map((c) => (
                  <ChipBtn key={c} active={form.category === c} onClick={() => setForm({ ...form, category: c })}>{t('expenses.' + c)}</ChipBtn>
                ))}
              </div>
            </Field>
            <Field label={t('common.amount')}>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label={t('common.notes')} hint={t('common.optional')}>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label={t('purchases.paymentSource')}>
              <div className="flex flex-wrap gap-2">
                <ChipBtn active={form.paymentSource === 'cash'} onClick={() => setForm({ ...form, paymentSource: 'cash' })}>{t('sales.cash')}</ChipBtn>
                {wallets.map((w) => (
                  <ChipBtn key={w.id} active={form.paymentSource === w.id} onClick={() => setForm({ ...form, paymentSource: w.id })}>{w.name}</ChipBtn>
                ))}
              </div>
            </Field>
            <Button className="w-full" onClick={submit} disabled={saving}>
              {saving ? <Spinner className="text-white" /> : t('common.save')}
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}

function ChipBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-primary text-white' : 'bg-bg text-ink'}`}>
      {children}
    </button>
  );
}
