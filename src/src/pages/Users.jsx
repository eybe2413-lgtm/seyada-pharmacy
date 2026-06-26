import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, UserCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Input, Select, Modal, Spinner, Badge } from '../components/ui';
import { fetchAllUsers, createStaffAccount, deactivateUser, reactivateUser, updateUserRole } from '../services/userService';

const emptyForm = { name: '', email: '', password: '', role: 'employee' };

export default function Users() {
  const { t } = useTranslation();
  const { user: actingUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setUsers(await fetchAllUsers());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setError('');
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      setError(t('auth.weakPassword'));
      return;
    }
    setSaving(true);
    try {
      await createStaffAccount({ email: form.email, password: form.password, name: form.name.trim(), role: form.role, actingUser });
      setForm(null);
      load();
    } catch (e) {
      setError(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u) {
    if (u.active === false) await reactivateUser(u.id, actingUser, u.name);
    else await deactivateUser(u.id, actingUser, u.name);
    load();
  }

  async function changeRole(u, role) {
    await updateUserRole(u.id, role, actingUser, u.name);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">{t('users.title')}</h1>
        <Button onClick={() => setForm(emptyForm)}>
          <Plus size={16} /> {t('users.addUser')}
        </Button>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center">
                  <UserCircle2 size={20} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-ink truncate">{u.name}</div>
                  <div className="text-[11px] text-sub truncate" dir="ltr">{u.email}</div>
                </div>
                <Badge tone={u.active === false ? 'danger' : 'primary'}>{u.active === false ? t('common.inactive') : t('common.active')}</Badge>
              </div>

              <Select value={u.role} onChange={(e) => changeRole(u, e.target.value)} className="mb-2">
                <option value="employee">{t('users.employee')}</option>
                <option value="manager">{t('users.manager')}</option>
              </Select>

              <Button variant={u.active === false ? 'secondary' : 'danger'} className="w-full" onClick={() => toggleActive(u)}>
                {u.active === false ? t('users.enable') : t('users.disable')}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={t('users.addUser')}>
        {form && (
          <>
            <Field label={t('common.name')}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t('auth.email')}>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </Field>
            <Field label={t('auth.password')}>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label={t('users.role')}>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="employee">{t('users.employee')}</option>
                <option value="manager">{t('users.manager')}</option>
              </Select>
            </Field>
            {error && <p className="text-xs text-danger font-semibold mb-3 text-center">{error}</p>}
            <Button className="w-full" onClick={submit} disabled={saving}>
              {saving ? <Spinner className="text-white" /> : t('common.save')}
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}
