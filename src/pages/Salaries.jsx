import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote } from 'lucide-react';
import { Button, Card, Field, Input, Modal, Spinner, Badge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllUsers } from '../services/userService';
import { fetchSalariesForMonth, setMonthlySalary, paySalaryInstallment } from '../services/salaryService';
import { fetchWallets } from '../services/financeService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function Salaries() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = t('common.currency');
  const [month, setMonth] = useState(currentMonth());
  const [employees, setEmployees] = useState([]);
  const [salaries, setSalaries] = useState({});
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null); // { uid, name, amount }
  const [payTarget, setPayTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [users, salaryRows, w] = await Promise.all([fetchAllUsers(), fetchSalariesForMonth(month), fetchWallets()]);
    setEmployees(users.filter((u) => u.active !== false));
    setSalaries(Object.fromEntries(salaryRows.map((s) => [s.employeeUid, s])));
    setWallets(w);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitEditAmount() {
    setSaving(true);
    try {
      await setMonthlySalary(editTarget.uid, editTarget.name, month, Number(editTarget.amount) || 0);
      setEditTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment() {
    const amount = Number(payTarget.amount);
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      await paySalaryInstallment({ employeeUid: payTarget.uid, employeeName: payTarget.name, month, amount, source: payTarget.source, user });
      setPayTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink">{t('salaries.title')}</h1>
        <Field label={t('salaries.selectMonth')}>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const s = salaries[emp.id] || { salaryAmount: 0, paidAmount: 0, remaining: 0 };
            return (
              <Card key={emp.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-soft flex items-center justify-center">
                    <Banknote size={16} className="text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-ink">{emp.name}</div>
                    <div className="text-[11px] text-sub">{emp.role === 'manager' ? t('users.manager') : t('users.employee')}</div>
                  </div>
                </div>

                <Row label={t('salaries.salaryAmount')} value={money(s.salaryAmount, currency)} />
                <Row label={t('salaries.paidAmount')} value={money(s.paidAmount, currency)} tone="primary" />
                <Row label={t('salaries.remainingAmount')} value={money(Math.max(0, s.salaryAmount - s.paidAmount), currency)} tone="danger" />

                <div className="flex gap-2 mt-3">
                  <Button variant="ghost" className="flex-1" onClick={() => setEditTarget({ uid: emp.id, name: emp.name, amount: String(s.salaryAmount) })}>
                    {t('common.edit')}
                  </Button>
                  <Button className="flex-1" onClick={() => setPayTarget({ uid: emp.id, name: emp.name, amount: String(Math.max(0, s.salaryAmount - s.paidAmount)), source: 'cash' })}>
                    {t('salaries.paySalary')}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`${t('salaries.salaryAmount')} — ${editTarget?.name}`}>
        {editTarget && (
          <>
            <Input type="number" value={editTarget.amount} onChange={(e) => setEditTarget({ ...editTarget, amount: e.target.value })} />
            <Button className="w-full mt-4" onClick={submitEditAmount} disabled={saving}>
              {saving ? <Spinner className="text-white" /> : t('common.save')}
            </Button>
          </>
        )}
      </Modal>

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={`${t('salaries.paySalary')} — ${payTarget?.name}`}>
        {payTarget && (
          <>
            <Field label={t('common.amount')}>
              <Input type="number" value={payTarget.amount} onChange={(e) => setPayTarget({ ...payTarget, amount: e.target.value })} />
            </Field>
            <Field label={t('purchases.paymentSource')}>
              <div className="flex flex-wrap gap-2">
                <ChipBtn active={payTarget.source === 'cash'} onClick={() => setPayTarget({ ...payTarget, source: 'cash' })}>{t('sales.cash')}</ChipBtn>
                {wallets.map((w) => (
                  <ChipBtn key={w.id} active={payTarget.source === w.id} onClick={() => setPayTarget({ ...payTarget, source: w.id })}>{w.name}</ChipBtn>
                ))}
              </div>
            </Field>
            <Button className="w-full" onClick={submitPayment} disabled={saving}>
              {saving ? <Spinner className="text-white" /> : t('salaries.paySalary')}
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-sub">{label}</span>
      <span className={`font-bold ${tone === 'primary' ? 'text-primary' : tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{value}</span>
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
