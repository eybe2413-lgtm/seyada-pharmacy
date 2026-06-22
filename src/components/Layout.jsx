import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  Truck,
  HandCoins,
  Wallet,
  Receipt,
  Banknote,
  BarChart3,
  Calculator,
  FileSpreadsheet,
  Users as UsersIcon,
  UserSquare2,
  Building2,
  ClipboardCheck,
  ScrollText,
  Settings as SettingsIcon,
  Menu,
  X,
  Bell,
  LogOut,
  Languages,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { setAppLanguage } from '../i18n';
import { fetchLowStockMedicines, fetchExpiringMedicines } from '../services/medicineService';
import { fetchTotalUnpaidDebt } from '../services/debtService';
import { runAutoArchiveIfDue } from '../services/archiveService';
import { ensureFinanceDoc, ensureDefaultWallets } from '../services/financeService';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, key: 'nav.dashboard', end: true },
  { to: '/medicines', icon: Pill, key: 'nav.medicines' },
  { to: '/sales', icon: ShoppingCart, key: 'nav.sales' },
  { to: '/purchases', icon: Truck, key: 'nav.purchases' },
  { to: '/stock-take', icon: ClipboardCheck, key: 'nav.stockTake' },
  { to: '/debts', icon: HandCoins, key: 'nav.debts' },
  { to: '/customers', icon: UserSquare2, key: 'nav.customers' },
  { to: '/suppliers', icon: Building2, key: 'nav.suppliers' },
  { to: '/wallets', icon: Wallet, key: 'nav.wallets', managerOnly: true },
  { to: '/expenses', icon: Receipt, key: 'nav.expenses' },
  { to: '/salaries', icon: Banknote, key: 'nav.salaries', managerOnly: true },
  { to: '/reports', icon: BarChart3, key: 'nav.reports', managerOnly: true },
  { to: '/accounts', icon: Calculator, key: 'nav.accounts', managerOnly: true },
  { to: '/import-medicines', icon: FileSpreadsheet, key: 'nav.importMedicines' },
  { to: '/users', icon: UsersIcon, key: 'nav.users', managerOnly: true },
  { to: '/audit-log', icon: ScrollText, key: 'nav.auditLog' },
  { to: '/settings', icon: SettingsIcon, key: 'nav.settings' },
];

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { user, isManager, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState({ lowStock: 0, expiring: 0, debt: 0 });

  // Compute RTL once so we can pick the correct translate direction in JS.
  // We deliberately avoid Tailwind's rtl:/ltr: modifier classes for the
  // sidebar transform because those generate selectors like
  //   [dir="rtl"] .rtl\:translate-x-full   (specificity 0-2-0)
  // which permanently outrank the responsive override
  //   @media(md) .md\:translate-x-0        (specificity 0-1-0)
  // meaning the sidebar would stay off-screen on every viewport in Arabic.
  // Computing direction in JS and applying a single plain class avoids the
  // specificity conflict entirely.
  const isRTL = i18n.dir() === 'rtl';
  const hiddenClass = isRTL ? 'translate-x-full' : '-translate-x-full';

  const loadNotifications = useCallback(async () => {
    try {
      const [low, expiring] = await Promise.all([
        fetchLowStockMedicines(),
        fetchExpiringMedicines(30),
      ]);
      let debt = 0;
      if (isManager) debt = await fetchTotalUnpaidDebt();
      setNotifications({ lowStock: low.length, expiring: expiring.length, debt });
    } catch (_) {
      // Notification errors must not crash the layout — staff may lack
      // Firestore read permissions for certain collections.
    }
  }, [isManager]);

  useEffect(() => {
    if (isManager) {
      ensureFinanceDoc().catch(() => {});
      ensureDefaultWallets().catch(() => {});
      runAutoArchiveIfDue().catch(() => {});
    }
    loadNotifications();
  }, [isManager, loadNotifications]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.managerOnly || isManager);
  const notifCount =
    notifications.lowStock + notifications.expiring + (notifications.debt > 0 ? 1 : 0);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* ── Mobile drawer backdrop ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={closeDrawer}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────
          On mobile  : fixed overlay that slides in/out from the start edge.
          On desktop : static flex column that stays always visible.

          KEY: we use a JS-computed translate class (hiddenClass) instead of
          Tailwind's rtl:/ltr: variants to avoid the specificity trap where
          [dir="rtl"] .rtl:translate-x-full (0-2-0) beats md:translate-x-0
          (0-1-0) and keeps the sidebar permanently off-screen in Arabic.
      ─────────────────────────────────────────────────────────────────────── */}
      <aside
        className={[
          // Mobile fixed positioning anchored to the start edge of the viewport.
          // start-0 = right:0 in RTL, left:0 in LTR — always correct.
          'fixed inset-y-0 start-0 z-50 w-64',
          'bg-white border-e border-line flex flex-col',
          'transition-transform duration-300 ease-in-out',
          // Desktop: un-fix and always show. md:inset-auto resets the
          // inset-y-0 / start-0 so they don't interfere with static flow.
          'md:relative md:inset-auto md:z-auto md:translate-x-0 md:flex-shrink-0',
          // Mobile open/closed state — plain translate, no RTL/LTR variants.
          drawerOpen ? 'translate-x-0' : hiddenClass,
        ].join(' ')}
      >
        {/* Logo / app name */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-line shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold text-lg shrink-0">
            S
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-ink text-sm truncate">{t('common.appName')}</div>
            <div className="text-[11px] text-sub truncate">Pharmacie Seyada</div>
          </div>
          {/* Close button — mobile only */}
          <button className="md:hidden text-sub hover:text-ink" onClick={closeDrawer}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeDrawer}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-ink hover:bg-bg'
                }`
              }
            >
              <item.icon size={18} className="shrink-0" />
              <span className="truncate">{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>

        {/* User / logout */}
        <div className="p-3 border-t border-line shrink-0">
          <div className="px-3 py-2 mb-1">
            <div className="text-xs font-bold text-ink truncate">{user?.name}</div>
            <div className="text-[11px] text-sub truncate">
              {isManager ? t('users.manager') : t('users.employee')}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-danger hover:bg-danger-soft transition-colors"
          >
            <LogOut size={18} />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="h-16 bg-white border-b border-line flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shrink-0">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-2 -ms-2 rounded-lg text-ink hover:bg-bg"
            onClick={() => setDrawerOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu size={22} />
          </button>
          <div className="hidden md:block" />

          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <button
              onClick={() => setAppLanguage(i18n.language === 'ar' ? 'fr' : 'ar')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-sub hover:bg-bg border border-line"
            >
              <Languages size={15} />
              {i18n.language === 'ar' ? 'FR' : 'AR'}
            </button>

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2.5 rounded-lg hover:bg-bg text-ink"
              >
                <Bell size={19} />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 bg-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute end-0 mt-2 w-72 bg-white border border-line rounded-xl shadow-xl p-3 z-50">
                  <div className="font-bold text-sm text-ink mb-2 px-1">
                    {t('notifications.title')}
                  </div>
                  {notifCount === 0 && (
                    <div className="text-xs text-sub px-1 py-3 text-center">
                      {t('notifications.noNotifications')}
                    </div>
                  )}
                  {notifications.lowStock > 0 && (
                    <NotifRow
                      color="bg-accent"
                      text={`${notifications.lowStock} — ${t('notifications.lowStock')}`}
                      onClick={() => { navigate('/medicines'); setNotifOpen(false); }}
                    />
                  )}
                  {notifications.expiring > 0 && (
                    <NotifRow
                      color="bg-danger"
                      text={`${notifications.expiring} — ${t('notifications.expiry')}`}
                      onClick={() => { navigate('/medicines'); setNotifOpen(false); }}
                    />
                  )}
                  {isManager && notifications.debt > 0 && (
                    <NotifRow
                      color="bg-primary"
                      text={t('notifications.debtDue')}
                      onClick={() => { navigate('/debts'); setNotifOpen(false); }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function NotifRow({ color, text, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-bg text-start"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <span className="text-xs text-ink">{text}</span>
    </button>
  );
}
