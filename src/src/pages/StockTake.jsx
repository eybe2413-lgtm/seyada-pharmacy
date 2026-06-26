import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ClipboardCheck } from 'lucide-react';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Input, Spinner, EmptyState, LoadMoreButton, Badge } from '../components/ui';
import { fetchMedicinesPage, searchMedicines, saveStockTakeSession, fetchStockTakeSessions } from '../services/medicineService';

export default function StockTake() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [searchResults, setSearchResults] = useState(null);
  const [counts, setCounts] = useState({}); // medicineId -> counted qty string
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [sessions, setSessions] = useState([]);

  const fetchPage = useCallback((cursor) => fetchMedicinesPage(cursor), []);
  const { items, loading, hasMore, loadingMore, loadMore } = usePaginatedCollection(fetchPage, []);

  React.useEffect(() => {
    let active = true;
    if (!debouncedSearch) {
      setSearchResults(null);
      return undefined;
    }
    searchMedicines(debouncedSearch).then((r) => active && setSearchResults(r));
    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  React.useEffect(() => {
    fetchStockTakeSessions().then(setSessions);
  }, []);

  const displayed = searchResults ?? items;
  const changedCount = Object.keys(counts).filter((id) => counts[id] !== '').length;

  async function applyAdjustments() {
    const changedItems = displayed
      .filter((m) => counts[m.id] !== undefined && counts[m.id] !== '' && Number(counts[m.id]) !== m.quantity)
      .map((m) => ({
        medicineId: m.id,
        medicineName: m.name,
        systemQty: m.quantity,
        countedQty: Number(counts[m.id]),
        lowStockThreshold: m.lowStockThreshold,
      }));

    if (changedItems.length === 0) {
      setMessage(t('stockTake.noChanges'));
      return;
    }
    if (!window.confirm(t('stockTake.confirmApply'))) return;

    setApplying(true);
    setMessage('');
    try {
      await saveStockTakeSession(changedItems, user);
      setCounts({});
      setMessage(t('stockTake.applied'));
      fetchStockTakeSessions().then(setSessions);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink">{t('stockTake.title')}</h1>
          <p className="text-xs text-sub mt-0.5">{t('stockTake.subtitle')}</p>
        </div>
        <Button onClick={applyAdjustments} disabled={applying || changedCount === 0}>
          {applying ? <Spinner className="text-white" /> : <ClipboardCheck size={16} />}
          {t('stockTake.apply')} {changedCount > 0 && `(${changedCount})`}
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-sub" />
        <Input className="ps-9" placeholder={t('medicines.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {message && <p className="text-sm font-semibold text-primary">{message}</p>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-sub text-xs">
              <tr>
                <th className="text-start px-4 py-3 font-bold">{t('medicines.medicineName')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('stockTake.systemQty')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('stockTake.countedQty')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('stockTake.variance')}</th>
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
              {displayed.map((m) => {
                const countedRaw = counts[m.id] ?? '';
                const variance = countedRaw === '' ? null : Number(countedRaw) - m.quantity;
                return (
                  <tr key={m.id} className="border-t border-line">
                    <td className="px-4 py-3 font-semibold text-ink">{m.name}</td>
                    <td className="px-4 py-3 text-sub">{m.quantity}</td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        className="w-24"
                        value={countedRaw}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder={String(m.quantity)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {variance !== null && variance !== 0 && (
                        <Badge tone={variance > 0 ? 'primary' : 'danger'}>{variance > 0 ? `+${variance}` : variance}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!searchResults && <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />}
      </Card>

      {sessions.length > 0 && (
        <Card className="p-4">
          <h3 className="font-bold text-sm text-ink mb-3">{t('stockTake.recentSessions')}</h3>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs border-b border-line last:border-0 pb-2 last:pb-0">
                <span className="text-sub">{s.date?.toDate ? s.date.toDate().toLocaleString() : '—'}</span>
                <span className="text-ink font-semibold">{s.performedByName}</span>
                <span className="text-sub">{t('stockTake.itemsChanged')}: {s.itemCount}</span>
                <Badge tone={s.totalVariance >= 0 ? 'primary' : 'danger'}>{s.totalVariance >= 0 ? `+${s.totalVariance}` : s.totalVariance}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
