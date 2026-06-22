import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Field, Input, Card } from '../components/ui';
import { setAppLanguage } from '../i18n';

export default function Login() {
  const { t, i18n } = useTranslation();
  const { user, loading, login, authError, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [resetMessage, setResetMessage] = useState('');

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(t('auth.loginError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setSubmitting(true);
    try {
      await resetPassword(email);
      setResetMessage(t('auth.resetEmailSent'));
    } catch (err) {
      setError(t('auth.loginError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-dark px-4">
      <div className="absolute top-4 end-4">
        <button
          onClick={() => setAppLanguage(i18n.language === 'ar' ? 'fr' : 'ar')}
          className="text-xs font-bold text-white/80 hover:text-white border border-white/30 rounded-lg px-3 py-1.5"
        >
          {i18n.language === 'ar' ? 'Français' : 'العربية'}
        </button>
      </div>

      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-extrabold text-3xl mb-3">S</div>
          <h1 className="text-xl font-extrabold text-ink">{t('auth.loginTitle')}</h1>
          <p className="text-xs text-sub text-center mt-1">{mode === 'login' ? t('auth.loginSubtitle') : t('auth.resetPasswordTitle')}</p>
        </div>

        {/* Surfaces real Firestore/Auth errors (e.g. undeployed rules) instead of a silent failure */}
        {authError && <p className="text-xs text-danger font-semibold mb-4 text-center leading-relaxed bg-danger-soft rounded-lg p-3">{authError}</p>}

        {mode === 'login' ? (
          <form onSubmit={handleSubmit}>
            <Field label={t('auth.email')}>
              <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="name@example.com" />
            </Field>
            <Field label={t('auth.password')}>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>

            {error && <p className="text-xs text-danger font-semibold mb-3 text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : t('auth.loginButton')}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setError('');
              }}
              className="w-full text-center text-xs font-semibold text-primary mt-4 hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <Field label={t('auth.email')}>
              <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="name@example.com" />
            </Field>

            {error && <p className="text-xs text-danger font-semibold mb-3 text-center">{error}</p>}
            {resetMessage && <p className="text-xs text-primary font-semibold mb-3 text-center">{resetMessage}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : t('auth.sendResetLink')}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setResetMessage('');
              }}
              className="w-full text-center text-xs font-semibold text-sub mt-4 hover:underline"
            >
              {t('auth.backToLogin')}
            </button>
          </form>
        )}

        {mode === 'login' && <p className="text-[11px] text-sub text-center mt-5 leading-relaxed">{t('auth.noAccountHint')}</p>}
      </Card>
    </div>
  );
}
