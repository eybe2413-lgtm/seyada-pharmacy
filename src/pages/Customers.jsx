import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, ChevronLeft, Phone } from 'lucide-react';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Input, Modal, Spinner, EmptyState, LoadMoreButton, Badge } from '../components/ui';
import { addCustomer, fetchCustomersPage, searchCustomers, fetchCustomerStatement } from '../services/customerService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}

export default function Customers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = t('common.currency');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [searchResults, setSearchResults] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statementFor, setStatementFor] = useState(null);

  const fetchPage = useCallback((cursor) => fetchCustomersPage(cursor), []);
  const { items, loading, refresh, hasMore, loadingMore, loadMore } = usePaginatedCollection(fetchPage, []);

  React.useEffect(() => {
    let active = true;
    if (!debouncedSearch) {
      setSearchResults(null);
      return undefined;
    }
    searchCustomers(debouncedSearch).then((r) => active && setSearchResults(r));
    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  const displayed = searchResults ?? items;

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await addCustomer({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), user });
      setForm(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  if (statementFor) {
    return <CustomerStatement customer={statementFor} currency={currency} onBack={() => setStatementFor(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink">{t('customers.title')}</h1>
        <Button onClick={() => setForm({ name: '', phone: '', address: '' })}>
          <Plus size={16} /> {t('customers.addCustomer')}
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-sub" />
        <Input className="ps-9" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-sub text-xs">
              <tr>
                <th className="text-start px-4 py-3 font-bold">{t('customers.name')}</th>
                <th className="text-start px-4 py-3 font-bold hidden sm:table-cell">{t('customers.phone')}</th>
                <th className="text-start px-4 py-3 font-bold hidden md:table-cell">{t('customers.address')}</th>
                <th className="px-4 py-3" />
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
              {!loading && displayed.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState>{t('common.noResults')}</EmptyState>
                  </td>
                </tr>
              )}
              {displayed.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-bg/60 cursor-pointer" onClick={() => setStatementFor(c)}>
                  <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
                  <td className="px-4 py-3 text-sub hidden sm:table-cell" dir="ltr">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-sub hidden md:table-cell">{c.address || '—'}</td>
                  <td className="px-4 py-3 text-end">
                    <span className="text-xs font-bold text-primary">{t('customers.viewStatement')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!searchResults && <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={t('customers.addCustomer')}>
        {form && (
          <div className="space-y-3">
            <Field label={t('customers.name')}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label={t('customers.phone')} hint={t('common.optional')}>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </Field>
            <Field label={t('customers.address')} hint={t('common.optional')}>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Button onClick={submit} disabled={saving} className="w-full">
              {saving ? <Spinner className="text-white" /> : t('common.save')}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CustomerStatement({ customer, currency, onBack }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  React.useEffect(() => {
    fetchCustomerStatement(customer.phone).then(setData);
  }, [customer.phone]);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-sub hover:text-ink">
        <ChevronLeft size={16} className="rtl:rotate-180" /> {t('customers.title')}
      </button>

      <div>
        <h1 className="text-xl font-extrabold text-ink">{customer.name}</h1>
        {customer.phone && (
          <p className="text-sm text-sub flex items-center gap-1.5 mt-1" dir="ltr">
            <Phone size={13} /> {customer.phone}
          </p>
        )}
      </div>

      {!data ? (
        <div className="py-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-sub">{t('customers.totalOriginal')}</p>
              <p className="text-lg font-extrabold text-ink mt-1">{money(data.totalOriginal, currency)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-sub">{t('customers.totalPaid')}</p>
              <p className="text-lg font-extrabold text-primary mt-1">{money(data.totalPaid, currency)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-sub">{t('customers.totalOwed')}</p>
              <p className="text-lg font-extrabold text-danger mt-1">{money(data.totalOwed, currency)}</p>
            </Card>
          </div>

          {data.debts.length === 0 ? (
            <EmptyState>{t('customers.noDebts')}</EmptyState>
          ) : (
            <div className="space-y-3">
              {data.debts.map((d) => (
                <Card key={d.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-sub">{d.date?.toDate ? d.date.toDate().toLocaleDateString() : '—'}</span>
                    <Badge tone={d.paid ? 'primary' : 'danger'}>{d.paid ? t('debts.paidStatus') : t('debts.unpaidStatus')}</Badge>
                  </div>
                  <p className="text-sm text-ink mb-2">{d.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-sub">{t('debts.remainingAmount')}: {money(d.amount, currency)}</span>
                    <span className="text-sub">{t('common.total')}: {money(d.originalAmount, currency)}</span>
                  </div>
                  {d.payments?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-line space-y-1.5">
                      {d.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-xs text-sub">
                          <span>{p.date?.toDate ? p.date.toDate().toLocaleDateString() : '—'}</span>
                          <span className="font-semibold text-ink">{money(p.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
