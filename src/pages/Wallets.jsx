import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Banknote, Wallet as WalletIcon, Pencil, RefreshCw } from 'lucide-react';
import { Button, Card, Field, Input, Modal, Spinner, Badge } from '../components/ui';
import { fetchWallets, addWallet, subscribeFinances, setCashBalance, setWalletBalance, fetchWalletTransactions, ensureDefaultWallets, deduplicateWallets } from '../services/financeService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}

export default function Wallets() {
  const { t } = useTranslation();
  const currency = t('common.currency');
  const [wallets, setWallets] = useState([]);
  const [finances, setFinances] = useState({ cash: 0, balances: {} });
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [history, setHistory] = useState([]);
  const [newWalletName, setNewWalletName] = useState('');
  const [addingWallet, setAddingWallet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function seedDefaultWallets() {
    setSeeding(true);
    try {
      await ensureDefaultWallets();
      await load();
    } finally {
      setSeeding(false);
    }
  }

  const load = useCallback(async () => {
    // Auto-clean duplicates from any previous race condition on first-ever load
    await deduplicateWallets().catch(() => {});
    const w = await fetchWallets();
    setWallets(w);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Real-time listener: balance updates instantly after any sale / purchase / expense
  useEffect(() => {
    const unsub = subscribeFinances(setFinances);
    return () => unsub();
  }, []);

  async function openHistory(source, label) {
    setHistoryTarget(label);
    const rows = await fetchWalletTransactions(source);
    setHistory(rows);
  }

  async function submitEdit() {
    const value = Number(editTarget.value);
    if (Number.isNaN(value)) return;
    setSaving(true);
    try {
      if (editTarget.key === 'cash') await setCashBalance(value);
      else await setWalletBalance(editTarget.key, value);
      setEditTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function submitNewWallet() {
    if (!newWalletName.trim()) return;
    setSaving(true);
    try {
      await addWallet(newWalletName.trim());
      setNewWalletName('');
      setAddingWallet(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const totalLiquidity = finances.cash + Object.values(finances.balances || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold text-ink">{t('wallets.title')}</h1>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 bg-primary text-white">
          <p className="text-xs font-semibold text-white/80">{t('wallets.totalLiquidity')}</p>
          <p className="text-2xl font-extrabold mt-1">{money(totalLiquidity, currency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-sub">إجمالي المحافظ والنقدي</p>
          <p className="text-2xl font-extrabold mt-1 text-primary">{money(totalLiquidity, currency)}</p>
        </Card>
      </div>

      <div className="space-y-2">
        <Row icon={Banknote} label={t('wallets.cashBalance')} value={money(finances.cash, currency)} onEdit={() => setEditTarget({ key: 'cash', label: t('wallets.cashBalance'), value: String(finances.cash) })} onHistory={() => openHistory('cash', t('wallets.cashBalance'))} />
        {wallets.map((w) => (
          <Row
            key={w.id}
            icon={WalletIcon}
            label={w.name}
            value={money(finances.balances?.[w.id] ?? 0, currency)}
            onEdit={() => setEditTarget({ key: w.id, label: w.name, value: String(finances.balances?.[w.id] ?? 0) })}
            onHistory={() => openHistory(w.id, w.name)}
          />
        ))}
      </div>

      {wallets.length === 0 && (
        <div className="text-center py-6 px-4 bg-primary-soft rounded-xl border border-primary/20 mb-2">
          <p className="text-sm text-primary-dark font-semibold mb-3">
            لم يتم إنشاء المحافظ الافتراضية بعد — اضغط الزر لإنشائها
          </p>
          <Button onClick={seedDefaultWallets} disabled={seeding}>
            {seeding ? <Spinner className="text-white" /> : <RefreshCw size={16} />}
            إنشاء: بنكيلي · مصرفي · السداد
          </Button>
        </div>
      )}

      <button onClick={() => setAddingWallet(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary text-primary font-bold text-sm">
        <Plus size={16} /> {t('wallets.addWallet')}
      </button>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`${t('wallets.editBalance')} — ${editTarget?.label}`}>
        {editTarget && (
          <>
            <Input type="number" value={editTarget.value} onChange={(e) => setEditTarget({ ...editTarget, value: e.target.value })} />
            <Button className="w-full mt-4" onClick={submitEdit} disabled={saving}>
              {saving ? <Spinner className="text-white" /> : t('common.save')}
            </Button>
          </>
        )}
      </Modal>

      <Modal open={addingWallet} onClose={() => setAddingWallet(false)} title={t('wallets.addWallet')}>
        <Field label={t('wallets.walletName')}>
          <Input value={newWalletName} onChange={(e) => setNewWalletName(e.target.value)} />
        </Field>
        <Button className="w-full" onClick={submitNewWallet} disabled={saving}>
          {saving ? <Spinner className="text-white" /> : t('common.add')}
        </Button>
      </Modal>

      <Modal open={!!historyTarget} onClose={() => setHistoryTarget(null)} title={`${t('wallets.transactionHistory')} — ${historyTarget}`}>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {history.length === 0 && <p className="text-xs text-sub text-center py-6">{t('common.noResults')}</p>}
          {history.map((h) => (
            <div key={h.type + h.id} className="flex items-center justify-between text-xs px-2 py-2 rounded-lg bg-bg">
              <div>
                <div className="font-semibold text-ink">{h.label}</div>
                <div className="text-sub">{h.date?.toDate().toLocaleString()}</div>
              </div>
              <Badge tone={h.amount >= 0 ? 'primary' : 'danger'}>{h.amount >= 0 ? '+' : ''}{money(h.amount, currency)}</Badge>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Row({ icon: Icon, label, value, onEdit, onHistory }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="p-2.5 rounded-lg bg-primary-soft">
        <Icon size={17} className="text-primary" />
      </div>
      <button className="flex-1 text-start" onClick={onHistory}>
        <div className="font-bold text-sm text-ink">{label}</div>
      </button>
      <div className="font-extrabold text-sm text-ink">{value}</div>
      <button onClick={onEdit} className="p-2 rounded-lg hover:bg-bg text-sub">
        <Pencil size={15} />
      </button>
    </Card>
  );
}
