import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Phone, MapPin, Search } from 'lucide-react';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Input, Modal, Spinner, EmptyState, LoadMoreButton, Badge } from '../components/ui';
import { fetchWallets } from '../services/financeService';
import { fetchUnpaidDebtsPage, fetchAllDebtsPage, addDebtManual, addDebtPayment, fetchDebtPayments, searchDebts } from '../services/debtService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}

export default function Debts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = t('common.currency');
  const [showAll, setShowAll] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const debouncedSearch = useDebounce(searchText, 350);

  const fetchPage = useCallback((cursor) => (showAll ? fetchAllDebtsPage({ cursor }) : fetchUnpaidDebtsPage({ cursor })), [showAll]);
  const { items, loading, refresh, hasMore, loadingMore, loadMore } = usePaginatedCollection(fetchPage, [showAll]);

  const [wallets, setWallets] = useState([]);
  const [addForm, setAddForm] = useState(null);
  const [detail, setDetail] = useState(null); // selected debt
  const [payments, setPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWallets().then(setWallets);
  }, []);

  useEffect(() => {
    let active = true;
    if (!debouncedSearch) { setSearchResults(null); return; }
    searchDebts(debouncedSearch).then((r) => active && setSearchResults(r));
    return () => { active = false; };
  }, [debouncedSearch]);

  const displayedItems = searchResults ?? items;

  async function openDetail(debt) {
    setDetail(debt);
    const p = await fetchDebtPayments(debt.id);
    setPayments(p);
  }

  async function submitAdd() {
    if (!addForm.personName.trim() || !Number(addForm.amount)) return;
    setSaving(true);
    try {
      await addDebtManual({ personName: addForm.personName.trim(), phone: addForm.phone.trim(), address: addForm.address.trim(), amount: Number(addForm.amount), description: addForm.description.trim(), user });
      setAddForm(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment() {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0 || amount > detail.amount) return;
    setSaving(true);
    try {
      await addDebtPayment({ debtId: detail.id, amount, source: paymentForm.source, user });
      setPaymentForm(null);
      setDetail(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink">{t('debts.title')}</h1>
        <div className="flex gap-2">
          <Button variant={showAll ? 'ghost' : 'secondary'} onClick={() => setShowAll(false)}>{t('debts.unpaidOnly')}</Button>
          <Button variant={showAll ? 'secondary' : 'ghost'} onClick={() => setShowAll(true)}>{t('debts.allDebts')}</Button>
          <Button onClick={() => setAddForm({ personName: '', phone: '', address: '', amount: '', description: '' })}>
            <Plus size={16} /> {t('debts.addDebt')}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-sub" />
        <Input
          className="ps-9"
          placeholder={t('debts.searchByName')}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading && (
          <div className="col-span-full py-10 flex justify-center">
            <Spinner />
          </div>
        )}
        {!loading && displayedItems.length === 0 && (
          <div className="col-span-full">
            <EmptyState>{t('common.noResults')}</EmptyState>
          </div>
        )}
        {displayedItems.map((d) => (
          <Card key={d.id} className="p-4 cursor-pointer hover:shadow-md" onClick={() => openDetail(d)}>
            <div className="flex items-start justify-between mb-2">
              <span className="font-bold text-sm text-ink">{d.personName}</span>
              {d.paid ? <Badge>—</Badge> : <Badge tone="danger">{money(d.amount, currency)}</Badge>}
            </div>
            {d.phone && (
              <div className="flex items-center gap-1.5 text-xs text-sub mb-1">
                <Phone size={12} /> {d.phone}
              </div>
            )}
            {d.address && (
              <div className="flex items-center gap-1.5 text-xs text-sub mb-1">
                <MapPin size={12} /> {d.address}
              </div>
            )}
            <p className="text-[11px] text-sub mt-1">{d.date?.toDate().toLocaleDateString()}</p>
          </Card>
        ))}
      </div>
      <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />

      <Modal open={!!addForm} onClose={() => setAddForm(null)} title={t('debts.addDebt')}>
        {addForm && (
          <>
            <Field label={t('debts.customerName')}>
              <Input value={addForm.personName} onChange={(e) => setAddForm({ ...addForm, personName: e.target.value })} />
            </Field>
            <Field label={t('common.phone')} hint={t('common.optional')}>
              <Input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} dir="ltr" />
            </Field>
            <Field label={t('common.address')} hint={t('common.optional')}>
              <Input value={addForm.address} onChange={(e) => setAddForm({ ...addForm, address: e.target.value })} />
            </Field>
            <Field label={t('debts.totalDebt')}>
              <Input type="number" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} />
            </Field>
            <Field label={t('common.notes')} hint={t('common.optional')}>
              <Input value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
            </Field>
            <Button className="w-full" onClick={submitAdd} disabled={saving}>
              {saving ? <Spinner className="text-white" /> : t('common.save')}
            </Button>
          </>
        )}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.personName} wide>
        {detail && (
          <div>
            <div className="flex items-center justify-between mb-4 p-3 bg-bg rounded-lg">
              <span className="text-sm font-semibold text-sub">{t('debts.remainingAmount')}</span>
              <span className="text-lg font-extrabold text-danger">{money(detail.amount, currency)}</span>
            </div>

            <h4 className="text-xs font-bold text-sub mb-2">{t('debts.paymentHistory')}</h4>
            <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto">
              {payments.length === 0 && <p className="text-xs text-sub text-center py-3">{t('debts.noPayments')}</p>}
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-bg/60">
                  <span className="text-sub">{p.date?.toDate().toLocaleDateString()}</span>
                  <span className="font-bold text-ink">{money(p.amount, currency)}</span>
                </div>
              ))}
            </div>

            {!detail.paid && (
              <>
                {!paymentForm ? (
                  <Button className="w-full" onClick={() => setPaymentForm({ amount: String(detail.amount), source: 'cash' })}>
                    {t('debts.addPayment')}
                  </Button>
                ) : (
                  <div className="border-t border-line pt-3">
                    <Field label={t('common.amount')}>
                      <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                    </Field>
                    <Field label={t('wallets.title')}>
                      <div className="flex flex-wrap gap-2">
                        <ChipBtn active={paymentForm.source === 'cash'} onClick={() => setPaymentForm({ ...paymentForm, source: 'cash' })}>{t('sales.cash')}</ChipBtn>
                        {wallets.map((w) => (
                          <ChipBtn key={w.id} active={paymentForm.source === w.id} onClick={() => setPaymentForm({ ...paymentForm, source: w.id })}>{w.name}</ChipBtn>
                        ))}
                      </div>
                    </Field>
                    <Button className="w-full" onClick={submitPayment} disabled={saving}>
                      {saving ? <Spinner className="text-white" /> : t('debts.settleDebt')}
                    </Button>
                  </div>
                )}
              </>
            )}
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
