import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, Phone, Mail } from 'lucide-react';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  Spinner,
  EmptyState,
  LoadMoreButton,
} from '../components/ui';
import {
  saveSupplier,
  deleteSupplier,
  fetchSuppliersPage,
  searchSuppliers,
} from '../services/supplierService';

const emptyForm = { id: null, name: '', phone: '', email: '', address: '', notes: '' };

export default function Suppliers() {
  const { t } = useTranslation();
  const { user, isManager } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [searchResults, setSearchResults] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const fetchPage = useCallback((cursor) => fetchSuppliersPage(cursor), []);
  const { items, loading, refresh, hasMore, loadingMore, loadMore } =
    usePaginatedCollection(fetchPage, []);

  React.useEffect(() => {
    let active = true;
    if (!debouncedSearch) { setSearchResults(null); return undefined; }
    searchSuppliers(debouncedSearch).then((r) => active && setSearchResults(r));
    return () => { active = false; };
  }, [debouncedSearch]);

  const displayed = searchResults ?? items;

  function openEdit(s) {
    setForm({
      id: s.id,
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || '',
    });
    setMessage('');
  }

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await saveSupplier(form, user);
      setForm(null);
      setSearchResults(null);
      refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form?.id) return;
    if (!window.confirm(t('common.deleteConfirm'))) return;
    setDeleting(true);
    try {
      await deleteSupplier(form.id, form.name, user);
      setForm(null);
      refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink">{t('suppliers.title')}</h1>
        <Button onClick={() => { setForm(emptyForm); setMessage(''); }}>
          <Plus size={16} /> {t('suppliers.addSupplier')}
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-sub" />
        <Input
          className="ps-9"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-sub text-xs">
              <tr>
                <th className="text-start px-4 py-3 font-bold">{t('suppliers.name')}</th>
                <th className="text-start px-4 py-3 font-bold hidden sm:table-cell">{t('suppliers.phone')}</th>
                <th className="text-start px-4 py-3 font-bold hidden md:table-cell">{t('suppliers.email')}</th>
                <th className="text-start px-4 py-3 font-bold hidden lg:table-cell">{t('suppliers.address')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center"><Spinner /></td>
                </tr>
              )}
              {!loading && displayed.length === 0 && (
                <tr>
                  <td colSpan={5}><EmptyState>{t('common.noResults')}</EmptyState></td>
                </tr>
              )}
              {displayed.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-line hover:bg-bg/60 cursor-pointer"
                  onClick={() => openEdit(s)}
                >
                  <td className="px-4 py-3 font-semibold text-ink">{s.name}</td>
                  <td className="px-4 py-3 text-sub hidden sm:table-cell" dir="ltr">
                    {s.phone
                      ? <span className="flex items-center gap-1.5"><Phone size={12}/>{s.phone}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sub hidden md:table-cell" dir="ltr">
                    {s.email
                      ? <span className="flex items-center gap-1.5"><Mail size={12}/>{s.email}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sub hidden lg:table-cell">{s.address || '—'}</td>
                  <td className="px-4 py-3">
                    <Pencil size={15} className="text-sub" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!searchResults && (
          <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
        )}
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? t('suppliers.editSupplier') : t('suppliers.addSupplier')}
      >
        {form && (
          <div className="space-y-1">
            <Field label={t('suppliers.name')}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </Field>
            <Field label={t('suppliers.phone')} hint={t('common.optional')}>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                dir="ltr"
              />
            </Field>
            <Field label={t('suppliers.email')} hint={t('common.optional')}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                dir="ltr"
              />
            </Field>
            <Field label={t('suppliers.address')} hint={t('common.optional')}>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label={t('suppliers.notes')} hint={t('common.optional')}>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>

            {message && (
              <p className="text-xs text-danger font-semibold">{message}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={submit} disabled={saving} className="flex-1">
                {saving ? <Spinner className="text-white" /> : t('common.save')}
              </Button>
              {form.id && isManager && (
                <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Spinner className="text-white" /> : <Trash2 size={16} />}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
