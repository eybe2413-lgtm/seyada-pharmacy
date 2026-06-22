import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, ScanBarcode, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Input, Badge, Modal, Spinner, EmptyState, LoadMoreButton } from '../components/ui';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BarcodeImage from '../components/BarcodeImage';
import {
  fetchMedicinesPage,
  searchMedicines,
  findMedicineByBarcode,
  fetchLowStockMedicines,
  fetchExpiringMedicines,
  fetchExpiredMedicines,
  saveMedicine,
  deleteMedicine,
  generateEan13Barcode,
} from '../services/medicineService';

const FILTERS = ['all', 'lowStock', 'expiring', 'expired'];
const emptyForm = {
  id: null,
  name: '',
  scientificName: '',
  category: '',
  barcode: '',
  costPrice: '',
  sellPrice: '',
  quantity: '',
  batchNumber: '',
  supplier: '',
  expiryDate: '',
  lowStockThreshold: '',
};

export default function Medicines() {
  const { t } = useTranslation();
  const { isManager } = useAuth();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [searchResults, setSearchResults] = useState(null);
  const [filterResults, setFilterResults] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const fetchPage = useCallback((cursor) => fetchMedicinesPage(cursor), []);
  const { items, loading, refresh, hasMore, loadingMore, loadMore } = usePaginatedCollection(fetchPage, []);

  React.useEffect(() => {
    let active = true;
    if (!debouncedSearch) {
      setSearchResults(null);
      return undefined;
    }
    // Searches both the trade name and the scientific/generic name.
    searchMedicines(debouncedSearch).then((r) => active && setSearchResults(r));
    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  React.useEffect(() => {
    let active = true;
    if (filter === 'all') {
      setFilterResults(null);
      return undefined;
    }
    setFilterLoading(true);
    const fn = filter === 'lowStock' ? fetchLowStockMedicines : filter === 'expiring' ? () => fetchExpiringMedicines(30) : fetchExpiredMedicines;
    fn()
      .then((r) => active && setFilterResults(r))
      .finally(() => active && setFilterLoading(false));
    return () => {
      active = false;
    };
  }, [filter]);

  const displayed = searchResults ?? filterResults ?? items;

  async function handleScan(code) {
    setScannerOpen(false);
    const med = await findMedicineByBarcode(code);
    if (med) openEdit(med);
    else setForm({ ...emptyForm, barcode: code });
  }

  // A USB scanner behaves like a keyboard typing fast + Enter. If the typed
  // text resolves to an exact barcode match on Enter, open that medicine
  // directly instead of relying on the (text-only) live search.
  async function handleSearchKeyDown(e) {
    if (e.key !== 'Enter' || !search.trim()) return;
    const med = await findMedicineByBarcode(search.trim());
    if (med) {
      e.preventDefault();
      setSearch('');
      setSearchResults(null);
      openEdit(med);
    }
  }

  function openEdit(med) {
    setForm({
      id: med.id,
      name: med.name,
      scientificName: med.scientificName || '',
      category: med.category || '',
      barcode: med.barcode || '',
      costPrice: String(med.costPrice ?? ''),
      sellPrice: String(med.sellPrice ?? ''),
      quantity: String(med.quantity ?? ''),
      batchNumber: med.batchNumber || '',
      supplier: med.supplier || '',
      expiryDate: med.expiryDate ? med.expiryDate.toDate().toISOString().slice(0, 10) : '',
      lowStockThreshold: String(med.lowStockThreshold ?? ''),
    });
  }

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await saveMedicine(form);
      setForm(null);
      setSearchResults(null);
      setFilterResults(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('medicines.deleteConfirm'))) return;
    await deleteMedicine(form.id);
    setForm(null);
    refresh();
  }

  const filterLabels = { all: t('common.all'), lowStock: t('medicines.lowStock'), expiring: t('medicines.expiring'), expired: t('medicines.expired') };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink">{t('medicines.title')}</h1>
        <Button onClick={() => setForm(emptyForm)}>
          <Plus size={16} /> {t('medicines.addMedicine')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-sub" />
          <Input
            className="ps-9"
            placeholder={t('medicines.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <Button variant="outline" onClick={() => setScannerOpen(true)}>
          <ScanBarcode size={16} /> {t('medicines.scanBarcode')}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white text-sub border-line'}`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-sub text-xs">
              <tr>
                <th className="text-start px-4 py-3 font-bold">{t('medicines.medicineName')}</th>
                <th className="text-start px-4 py-3 font-bold hidden md:table-cell">{t('medicines.category')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('medicines.quantity')}</th>
                <th className="text-start px-4 py-3 font-bold hidden sm:table-cell">{t('medicines.salePrice')}</th>
                <th className="text-start px-4 py-3 font-bold hidden lg:table-cell">{t('medicines.expiryDate')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(loading || filterLoading) && (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <Spinner />
                  </td>
                </tr>
              )}
              {!loading && !filterLoading && displayed.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState>{t('common.noResults')}</EmptyState>
                  </td>
                </tr>
              )}
              {displayed.map((m) => (
                <tr key={m.id} className="border-t border-line hover:bg-bg/60 cursor-pointer" onClick={() => openEdit(m)}>
                  <td className="px-4 py-3 font-semibold text-ink">
                    {m.name}
                    {m.scientificName && <div className="text-[11px] text-sub font-normal">{m.scientificName}</div>}
                  </td>
                  <td className="px-4 py-3 text-sub hidden md:table-cell">{m.category || '—'}</td>
                  <td className="px-4 py-3">
                    {m.isLowStock ? <Badge tone="accent">{m.quantity}</Badge> : <span>{m.quantity}</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">{m.sellPrice}</td>
                  <td className="px-4 py-3 text-sub hidden lg:table-cell">{m.expiryDate ? m.expiryDate.toDate().toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <Pencil size={15} className="text-sub" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!searchResults && !filterResults && <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />}
      </Card>

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScan} />

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? t('medicines.editMedicine') : t('medicines.addMedicine')} wide>
        {form && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label={t('medicines.medicineName')}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label={t('medicines.scientificName')} hint={t('common.optional')}>
              <Input value={form.scientificName} onChange={(e) => setForm({ ...form, scientificName: e.target.value })} />
            </Field>
            <Field label={t('medicines.category')}>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label={t('medicines.batchNumber')}>
              <Input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            </Field>

            <Field label={t('medicines.barcode')}>
              <div className="flex gap-2">
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} dir="ltr" className="flex-1" />
                <button
                  type="button"
                  title={t('medicines.generateBarcode')}
                  onClick={() => setForm({ ...form, barcode: generateEan13Barcode() })}
                  className="px-3 rounded-lg border border-line text-sub hover:bg-bg shrink-0"
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </Field>
            <div className="flex items-end pb-1">{form.barcode && <BarcodeImage value={form.barcode} height={36} />}</div>

            <Field label={t('medicines.purchasePrice')}>
              <Input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </Field>
            <Field label={t('medicines.salePrice')}>
              <Input type="number" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
            </Field>
            <Field label={t('medicines.quantity')}>
              <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label={t('medicines.lowStockThreshold')} hint={t('common.optional')}>
              <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
            </Field>
            <Field label={t('medicines.supplier')}>
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </Field>
            <Field label={t('medicines.expiryDate')}>
              <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </Field>

            <div className="sm:col-span-2 flex gap-3 mt-2">
              <Button onClick={submit} disabled={saving} className="flex-1">
                {saving ? <Spinner className="text-white" /> : t('common.save')}
              </Button>
              {form.id && isManager && (
                <Button variant="danger" onClick={handleDelete}>
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
