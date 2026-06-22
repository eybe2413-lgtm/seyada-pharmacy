import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Languages, KeyRound, Wallet, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { setAppLanguage } from '../i18n';
import { Card, Field, Input, Button, Spinner } from '../components/ui';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { isManager, changeOwnPassword } = useAuth();
  const navigate = useNavigate();

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submitPassword() {
    setError('');
    setMessage('');
    if (pwForm.next.length < 6) {
      setError(t('auth.weakPassword'));
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setSaving(true);
    try {
      await changeOwnPassword(pwForm.current, pwForm.next);
      setMessage(t('auth.passwordChanged'));
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (e) {
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-xl font-extrabold text-ink">{t('settings.title')}</h1>

      <Card className="p-5">
        <h2 className="font-bold text-sm text-ink mb-3 flex items-center gap-2">
          <Languages size={16} /> {t('settings.language')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setAppLanguage('ar')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${i18n.language === 'ar' ? 'bg-primary text-white' : 'bg-bg text-ink'}`}
          >
            {t('settings.arabic')}
          </button>
          <button
            onClick={() => setAppLanguage('fr')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${i18n.language === 'fr' ? 'bg-primary text-white' : 'bg-bg text-ink'}`}
          >
            {t('settings.french')}
          </button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-bold text-sm text-ink mb-3 flex items-center gap-2">
          <KeyRound size={16} /> {t('auth.changePasswordTitle')}
        </h2>
        <Field label={t('auth.currentPassword')}>
          <Input type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} />
        </Field>
        <Field label={t('auth.newPassword')}>
          <Input type="password" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} />
        </Field>
        <Field label={t('auth.confirmPassword')}>
          <Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
        </Field>
        {error && <p className="text-xs text-danger font-semibold mb-3">{error}</p>}
        {message && <p className="text-xs text-primary font-semibold mb-3">{message}</p>}
        <Button onClick={submitPassword} disabled={saving}>
          {saving ? <Spinner className="text-white" /> : t('common.save')}
        </Button>
      </Card>

      {isManager && (
        <Card className="p-5">
          <h2 className="font-bold text-sm text-ink mb-3 flex items-center gap-2">
            <Wallet size={16} /> {t('settings.wallets')}
          </h2>
          <Button variant="secondary" onClick={() => navigate('/wallets')}>
            {t('nav.wallets')}
          </Button>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-bold text-sm text-ink mb-2 flex items-center gap-2">
          <Info size={16} /> {t('settings.about')}
        </h2>
        <p className="text-xs text-sub leading-relaxed">{t('common.appName')} — Pharmacie Seyada · v1.0.0</p>
      </Card>
    </div>
  );
}
