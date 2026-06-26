import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Input, Modal, Spinner, EmptyState, LoadMoreButton } from '../components/ui';
import { searchMedicines } from '../services/medicineService';
import { fetchWallets } from '../services/financeService';
import { recordPurchase, fetchPurchasesPage } from '../services/purchaseService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}

// التعديل ٦: حذف sellPrice من emptyForm لعدم حساب المعادلة تلقائياً
const emptyForm = { mode: 'existing', medicineId: null, medicineName: '', newName: '', newCategory: '', newBarcode: '', quantity: '', unitCost: '', sellPrice: '', expiryDate: '', supplier: '', batchNumber: '', paymentSource: 'cash' };

export default function Purchases() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = t('common.currency');

  const fetchPage = useCallback((cursor) => fetchPurchasesPage({ cursor }), []);
  const { items, loading, refresh, hasMore, loadingMore, loadMore } = usePaginatedCollection(fetchPage, []);

  const [wallets, setWallets] = useState([]);
  const [form, setForm] = useState(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWallets().then(setWallets);
  }, []);

  useEffect(() => {
    let active = true;
    if (!debouncedQuery) {
      setResults([]);
      return;
    }
    searchMedicines(debouncedQuery).then((r) => active && setResults(r));
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  function pickMedicine(med) {
    // التعديل ٦: لا نحسب سعر البيع تلقائياً — يُدخل يدوياً
    setForm({ ...form, medicineId: med.id, medicineName: med.name, unitCost: String(med.costPrice || ''), sellPrice: String(med.sellPrice || '') });
    setQuery('');
    setResults([]);
  }

  async function submit() {
    const quantity = Number(form.quantity);
    const unitCost = Number(form.unitCost);
    if (!quantity || quantity <= 0 || !unitCost || unitCost <= 0) return;
    if (form.mode === 'existing' && !form.medicineId) return;
    if (form.mode === 'new' && !form.newName.trim()) return;

    setSaving(true);
    try {
      await recordPurchase({
        medicineId: form.mode === 'existing' ? form.medicineId : null,
        newMed: form.mode === 'new' ? { name: form.newName.trim(), category: form.newCategory.trim(), barcode: form.newBarcode.trim(), sellPrice: Number(form.sellPrice) || 0, expiryDate: form.expiryDate || null } : null,
        quantity,
        unitCost,
        sellPrice: form.mode === 'existing' ? (Number(form.sellPrice) || null) : null,
        supplier: form.supplier.trim(),
        batchNumber: form.batchNumber.trim(),
        paymentSource: form.paymentSource,
        user,
      });
      setForm(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">{t('purchases.title')}</h1>
        <Button onClick={() => setForm(emptyForm)}>
          <Plus size={16} /> {t('purchases.newPurchase')}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-sub text-xs">
              <tr>
                <th className="text-start px-4 py-3 font-bold">{t('medicines.medicineName')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('medicines.quantity')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('common.amount')}</th>
                <th className="text-start px-4 py-3 font-bold hidden md:table-cell">{t('purchases.supplier')}</th>
                <th className="text-start px-4 py-3 font-bold hidden sm:table-cell">{t('common.date')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <Spinner />
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState>{t('common.noResults')}</EmptyState>
                  </td>
                </tr>
              )}
              {items.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-3 font-semibold text-ink">{p.medicineName}</td>
                  <td className="px-4 py-3">{p.quantity}</td>
                  <td className="px-4 py-3 font-bold text-danger">{money(p.total, currency)}</td>
                  <td className="px-4 py-3 text-sub hidden md:table-cell">{p.supplier || '—'}</td>
                  <td className="px-4 py-3 text-sub hidden sm:table-cell">{p.date?.toDate().toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={t('purchases.newPurchase')} wide>
        {form && (
          <div>
            <div className="flex gap-2 mb-4">
              <ChipBtn active={form.mode === 'existing'} onClick={() => setForm({ ...form, mode: 'existing' })}>{t('purchases.existingMedicine')}</ChipBtn>
              <ChipBtn active={form.mode === 'new'} onClick={() => setForm({ ...form, mode: 'new' })}>{t('purchases.newMedicine')}</ChipBtn>
            </div>

            {form.mode === 'existing' ? (
              <div>
                <Field label={t('medicines.medicineName')}>
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} />
                  {results.length > 0 && (
                    <div className="mt-1.5 border border-line rounded-lg overflow-hidden divide-y divide-line">
                      {results.map((m) => (
                        <button key={m.id} type="button" onClick={() => pickMedicine(m)} className="w-full text-start px-3 py-2 text-sm hover:bg-bg">
                          {m.name} — {t('medicines.quantity')}: {m.quantity}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.medicineId && <p className="text-xs font-bold text-primary mt-1.5">{form.medicineName}</p>}
                </Field>
                {/* التعديل ٦: حقل سعر البيع يدوي بدون معادلة تلقائية */}
                <Field label={t('medicines.salePrice')}>
                  <Input type="number" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
                </Field>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-4">
                <Field label={t('medicines.medicineName')}>
                  <Input value={form.newName} onChange={(e) => setForm({ ...form, newName: e.target.value })} />
                </Field>
                <Field label={t('medicines.category')}>
                  <Input value={form.newCategory} onChange={(e) => setForm({ ...form, newCategory: e.target.value })} />
                </Field>
                <Field label={t('medicines.barcode')}>
                  <Input value={form.newBarcode} onChange={(e) => setForm({ ...form, newBarcode: e.target.value })} dir="ltr" />
                </Field>
                <Field label={t('medicines.salePrice')}>
                  <Input type="number" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
                </Field>
                <Field label={t('medicines.expiryDate')}>
                  <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
                </Field>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-x-4 mt-1">
              <Field label={t('medicines.quantity')}>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </Field>
              <Field label={t('purchases.unitCost')}>
                <Input type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
              </Field>
              <Field label={t('purchases.supplier')} hint={t('common.optional')}>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </Field>
              <Field label={t('medicines.batchNumber')} hint={t('common.optional')}>
                <Input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
              </Field>
            </div>

            <Field label={t('purchases.paymentSource')}>
              <div className="flex flex-wrap gap-2">
                <ChipBtn active={form.paymentSource === 'cash'} onClick={() => setForm({ ...form, paymentSource: 'cash' })}>{t('sales.cash')}</ChipBtn>
                {wallets.map((w) => (
                  <ChipBtn key={w.id} active={form.paymentSource === w.id} onClick={() => setForm({ ...form, paymentSource: w.id })}>{w.name}</ChipBtn>
                ))}
              </div>
            </Field>

            <Button className="w-full mt-2" onClick={submit} disabled={saving}>
              {saving ? <Spinner className="text-white" /> : t('purchases.recordInvoice')}
            </Button>
          </div>
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
