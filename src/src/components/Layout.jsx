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
  FileSpreadsheet,
  Users as UsersIcon,
  UserSquare2,
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
  { to: '/debts', icon: HandCoins, key: 'nav.debts' },
  { to: '/customers', icon: UserSquare2, key: 'nav.customers' },
  { to: '/stock-take', icon: ClipboardCheck, key: 'nav.stockTake' },
  { to: '/wallets', icon: Wallet, key: 'nav.wallets', managerOnly: true },
  { to: '/expenses', icon: Receipt, key: 'nav.expenses' },
  { to: '/salaries', icon: Banknote, key: 'nav.salaries', managerOnly: true },
  { to: '/reports', icon: BarChart3, key: 'nav.reports', managerOnly: true },
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

  const loadNotifications = useCallback(async () => {
    const [low, expiring] = await Promise.all([fetchLowStockMedicines(), fetchExpiringMedicines(30)]);
    let debt = 0;
    if (isManager) debt = await fetchTotalUnpaidDebt();
    setNotifications({ lowStock: low.length, expiring: expiring.length, debt });
  }, [isManager]);

  useEffect(() => {
    if (isManager) {
      ensureFinanceDoc();
      ensureDefaultWallets();
      runAutoArchiveIfDue();
    }
    loadNotifications();
  }, [isManager, loadNotifications]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.managerOnly || isManager);
  const notifCount = notifications.lowStock + notifications.expiring + (notifications.debt > 0 ? 1 : 0);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function toggleLanguage() {
    setAppLanguage(i18n.language === 'ar' ? 'fr' : 'ar');
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Mobile drawer overlay */}
      {drawerOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setDrawerOpen(false)} />}

      <aside
        className={`fixed md:static z-50 md:z-auto top-0 bottom-0 w-64 bg-white border-e border-line flex flex-col transition-transform
        ${drawerOpen ? 'translate-x-0' : 'translate-x-full rtl:translate-x-full ltr:-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-line">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold text-lg shrink-0">
            S
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-ink text-sm truncate">{t('common.appName')}</div>
            <div className="text-[11px] text-sub truncate">Pharmacie Seyada</div>
          </div>
          <button className="md:hidden ms-auto text-sub" onClick={() => setDrawerOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                  isActive ? 'bg-primary text-white' : 'text-ink hover:bg-bg'
                }`
              }
            >
              <item.icon size={18} />
              <span>{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <div className="px-3 py-2 mb-1">
            <div className="text-xs font-bold text-ink truncate">{user?.name}</div>
            <div className="text-[11px] text-sub truncate">{isManager ? t('users.manager') : t('users.employee')}</div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-danger hover:bg-danger-soft">
            <LogOut size={18} />
            {t('common.logout')}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-line flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <button className="text-ink" onClick={() => setDrawerOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="hidden md:block" />

          <div className="flex items-center gap-2">
            <button onClick={toggleLanguage} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-sub hover:bg-bg border border-line">
              <Languages size={15} />
              {i18n.language === 'ar' ? 'FR' : 'AR'}
            </button>

            <div className="relative">
              <button onClick={() => setNotifOpen((o) => !o)} className="relative p-2.5 rounded-lg hover:bg-bg text-ink">
                <Bell size={19} />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 bg-danger text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute end-0 mt-2 w-72 bg-white border border-line rounded-xl2 shadow-xl p-3 z-50">
                  <div className="font-bold text-sm text-ink mb-2 px-1">{t('notifications.title')}</div>
                  {notifCount === 0 && <div className="text-xs text-sub px-1 py-3 text-center">{t('notifications.noNotifications')}</div>}
                  {notifications.lowStock > 0 && (
                    <NotifRow color="bg-accent" text={`${notifications.lowStock} — ${t('notifications.lowStock')}`} onClick={() => navigate('/medicines')} />
                  )}
                  {notifications.expiring > 0 && (
                    <NotifRow color="bg-danger" text={`${notifications.expiring} — ${t('notifications.expiry')}`} onClick={() => navigate('/medicines')} />
                  )}
                  {isManager && notifications.debt > 0 && (
                    <NotifRow color="bg-primary" text={t('notifications.debtDue')} onClick={() => navigate('/debts')} />
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function NotifRow({ color, text, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-bg text-start">
      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <span className="text-xs text-ink">{text}</span>
    </button>
  );
}
