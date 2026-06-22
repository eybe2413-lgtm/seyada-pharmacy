import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { Card, Select, Spinner, EmptyState, LoadMoreButton, Badge } from '../components/ui';
import { fetchAuditLogPage } from '../services/auditService';
import { fetchAllUsers } from '../services/userService';

const ACTION_TONES = {
  'sale.create': 'primary',
  'purchase.create': 'default',
  'expense.create': 'danger',
  'debt.payment': 'primary',
  'debt.create': 'danger',
  'salary.pay': 'accent',
  'user.deactivate': 'danger',
};

export default function AuditLog() {
  const { t } = useTranslation();
  const { user, isManager } = useAuth();
  const [filterUser, setFilterUser] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (isManager) fetchAllUsers().then(setUsers);
  }, [isManager]);

  // Employees can only query their own entries (enforced by Firestore rules).
  const effectiveUserId = isManager ? filterUser || null : user.uid;

  const fetchPage = useCallback((cursor) => fetchAuditLogPage({ cursor, userId: effectiveUserId }), [effectiveUserId]);
  const { items, loading, hasMore, loadingMore, loadMore } = usePaginatedCollection(fetchPage, [effectiveUserId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink">{t('auditLog.title')}</h1>
        {isManager && (
          <Select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="w-56">
            <option value="">{t('common.all')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg text-sub text-xs">
              <tr>
                <th className="text-start px-4 py-3 font-bold">{t('auditLog.timestamp')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('auditLog.user')}</th>
                <th className="text-start px-4 py-3 font-bold">{t('auditLog.action')}</th>
                <th className="text-start px-4 py-3 font-bold hidden md:table-cell">{t('auditLog.target')}</th>
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
              {items.map((log) => (
                <tr key={log.id} className="border-t border-line">
                  <td className="px-4 py-3 text-sub whitespace-nowrap">{log.timestamp?.toDate().toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{log.userName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ACTION_TONES[log.action] || 'default'}>{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sub hidden md:table-cell truncate max-w-xs">{log.details || log.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
      </Card>
    </div>
  );
}
