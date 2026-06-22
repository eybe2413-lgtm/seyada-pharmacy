import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ScanBarcode, Plus, Minus, Trash2, ShoppingCart, Printer } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { usePaginatedCollection } from '../hooks/usePaginatedCollection';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Input, Badge, Spinner, EmptyState, LoadMoreButton } from '../components/ui';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { searchMedicines, findMedicineByBarcode } from '../services/medicineService';
import { fetchWallets } from '../services/financeService';
import { recordSale, fetchSalesPage } from '../services/salesService';
import { printSaleInvoice } from '../services/exportService';

function money(n, currency) {
  return (Number(n) || 0).toLocaleString('en-US') + ' ' + currency;
}

function invoiceLabels(t) {
  return {
    invoice: t('sales.invoice'),
    item: t('sales.item'),
    qty: t('sales.qty'),
    price: t('sales.price'),
    lineTotal: t('sales.lineTotal'),
    subtotal: t('sales.subtotal'),
    discount: t('sales.discount'),
    total: t('common.total'),
    paymentMethod: t('sales.paymentMethod'),
    soldBy: t('sales.soldBy'),
  };
}

function paymentLabel(sale, wallets, t) {
  if (sale.paymentMethod === 'cash') return t('sales.cash');
  if (sale.paymentMethod === 'debt') return t('sales.debt');
  return wallets.find((w) => w.id === sale.paymentMethod)?.name || sale.paymentMethod;
}

export default function Sales() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const currency = t('common.currency');
  const [tab, setTab] = useState('new');

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSale, setLastSale] = useState(null);
  const inputRef = useRef(null);

  React.useEffect(() => {
    fetchWallets().then(setWallets);
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!debouncedQuery) {
      setResults([]);
      return undefined;
    }
    searchMedicines(debouncedQuery).then((r) => active && setResults(r));
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  function addToCart(med) {
    setCart((prev) => {
      const existing = prev.find((i) => i.medicineId === med.id);
      if (existing) {
        if (existing.qty >= med.quantity) return prev;
        return prev.map((i) => (i.medicineId === med.id ? { ...i, qty: i.qty + 1 } : i));
      }
      if (med.quantity <= 0) return prev;
      return [...prev, { medicineId: med.id, name: med.name, price: med.sellPrice, qty: 1, maxQty: med.quantity }];
    });
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }

  async function handleScan(code) {
    setScannerOpen(false);
    const med = await findMedicineByBarcode(code);
    if (med) addToCart(med);
    else setMessage(t('common.noResults'));
  }

  // USB scanners behave like a keyboard typing fast + Enter — if the typed
  // text resolves to an exact barcode match on Enter, add it directly.
  async function handleKeyDown(e) {
    if (e.key !== 'Enter' || !query.trim()) return;
    const med = await findMedicineByBarcode(query.trim());
    if (med) {
      e.preventDefault();
      addToCart(med);
    }
  }

  function updateQty(medicineId, delta) {
    setCart((prev) =>
      prev
        .map((i) => (i.medicineId === medicineId ? { ...i, qty: Math.max(1, Math.min(i.maxQty, i.qty + delta)) } : i))
        .filter((i) => i.qty > 0)
    );
  }
  function removeItem(medicineId) {
    setCart((prev) => prev.filter((i) => i.medicineId !== medicineId));
  }

  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const discount = Math.max(0, Math.min(Number(discountInput) || 0, subtotal));
  const total = subtotal - discount;

  async function confirmSale() {
    if (cart.length === 0) return;
    if (paymentMethod === 'debt' && !customerName.trim()) {
      setMessage(t('debts.customerName'));
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const customer = customerName.trim() ? { name: customerName.trim(), phone: customerPhone.trim() } : null;
      const result = await recordSale({
        cart,
        paymentMethod,
        customer,
        walletId: paymentMethod !== 'cash' && paymentMethod !== 'debt' ? paymentMethod : null,
        discount,
        user,
      });
      setLastSale({
        ...result,
        items: cart,
        paymentMethod,
        soldByName: user.name,
        date: { toDate: () => new Date() },
      });
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountInput('');
      setPaymentMethod('cash');
      setMessage(t('sales.saleSuccess'));
    } catch (e) {
      setMessage(e.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrint(sale) {
    printSaleInvoice({
      sale,
      appName: t('common.appName'),
      currency,
      lang: i18n.language,
      labels: { ...invoiceLabels(t), paymentLabel: paymentLabel(sale, wallets, t) },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">{t('sales.title')}</h1>
        <div className="flex gap-2">
          <TabBtn active={tab === 'new'} onClick={() => setTab('new')}>{t('sales.newInvoice')}</TabBtn>
          <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>{t('sales.history')}</TabBtn>
        </div>
      </div>

      {tab === 'new' ? (
        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 space-y-3">
            <Card className="p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-sub" />
                  <Input ref={inputRef} className="ps-9" autoFocus placeholder={t('sales.scanOrSearch')} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown} />
                </div>
                <Button variant="outline" onClick={() => setScannerOpen(true)}>
                  <ScanBarcode size={16} />
                </Button>
              </div>
              <p className="text-[11px] text-sub mt-1.5">{t('sales.scanHint')}</p>

              {results.length > 0 && (
                <div className="mt-2 border border-line rounded-lg overflow-hidden divide-y divide-line">
                  {results.map((m) => (
                    <button key={m.id} onClick={() => addToCart(m)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-bg text-start">
                      <span className="text-sm font-semibold text-ink">
                        {m.name}
                        {m.scientificName && <span className="text-xs font-normal text-sub"> · {m.scientificName}</span>}
                      </span>
                      <span className="text-xs text-sub">{money(m.sellPrice, currency)} · {m.quantity}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-bold text-sm text-ink mb-3 flex items-center gap-2">
                <ShoppingCart size={16} /> {t('sales.cart')}
              </h3>
              {cart.length === 0 ? (
                <EmptyState>{t('sales.emptyCart')}</EmptyState>
              ) : (
                <div className="space-y-2">
                  {cart.map((i) => (
                    <div key={i.medicineId} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink truncate">{i.name}</div>
                        <div className="text-xs text-sub">{money(i.price, currency)}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQty(i.medicineId, -1)} className="w-7 h-7 rounded-lg bg-bg flex items-center justify-center">
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center text-sm font-bold">{i.qty}</span>
                        <button onClick={() => updateQty(i.medicineId, 1)} className="w-7 h-7 rounded-lg bg-bg flex items-center justify-center">
                          <Plus size={13} />
                        </button>
                      </div>
                      <div className="w-20 text-end text-sm font-bold">{money(i.price * i.qty, currency)}</div>
                      <button onClick={() => removeItem(i.medicineId)} className="text-danger">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="p-4 sticky top-20">
              <Field label={t('sales.customer')} hint={t('common.optional')}>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('sales.walkInCustomer')} />
              </Field>
              {customerName.trim() && (
                <Field label={t('common.phone')} hint={t('common.optional')}>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} dir="ltr" />
                </Field>
              )}

              <Field label={t('sales.discount')} hint={t('common.optional')}>
                <Input type="number" min="0" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" />
              </Field>

              <div className="space-y-1 mb-3 pb-3 border-b border-line">
                <div className="flex items-center justify-between text-xs text-sub">
                  <span>{t('sales.subtotal')}</span>
                  <span>{money(subtotal, currency)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between text-xs text-danger">
                    <span>{t('sales.discount')}</span>
                    <span>-{money(discount, currency)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-sub">{t('common.total')}</span>
                <span className="text-2xl font-extrabold text-primary">{money(total, currency)}</span>
              </div>

              <Field label={t('sales.paymentMethod')}>
                <div className="flex flex-wrap gap-2">
                  <ChipBtn active={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')}>{t('sales.cash')}</ChipBtn>
                  {wallets.map((w) => (
                    <ChipBtn key={w.id} active={paymentMethod === w.id} onClick={() => setPaymentMethod(w.id)}>{w.name}</ChipBtn>
                  ))}
                  <ChipBtn active={paymentMethod === 'debt'} onClick={() => setPaymentMethod('debt')}>{t('sales.debt')}</ChipBtn>
                </div>
              </Field>

              {message && <p className="text-xs font-semibold text-center mb-3 text-primary">{message}</p>}

              <Button className="w-full" onClick={confirmSale} disabled={submitting || cart.length === 0}>
                {submitting ? <Spinner className="text-white" /> : t('sales.confirmSale')}
              </Button>

              {lastSale && (
                <Button variant="outline" className="w-full mt-2" onClick={() => handlePrint(lastSale)}>
                  <Printer size={16} /> {t('sales.printInvoice')}
                </Button>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <SalesHistory currency={currency} wallets={wallets} onPrint={handlePrint} />
      )}

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScan} />
    </div>
  );
}

function SalesHistory({ currency, wallets, onPrint }) {
  const { t } = useTranslation();
  const fetchPage = useCallback((cursor) => fetchSalesPage({ cursor }), []);
  const { items, loading, hasMore, loadingMore, loadMore } = usePaginatedCollection(fetchPage, []);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg text-sub text-xs">
            <tr>
              <th className="text-start px-4 py-3 font-bold">{t('common.date')}</th>
              <th className="text-start px-4 py-3 font-bold">{t('common.amount')}</th>
              <th className="text-start px-4 py-3 font-bold hidden sm:table-cell">{t('sales.paymentMethod')}</th>
              <th className="text-start px-4 py-3 font-bold hidden md:table-cell">{t('sales.soldBy')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <Spinner />
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState>{t('common.noResults')}</EmptyState>
                </td>
              </tr>
            )}
            {items.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-3 text-sub">{s.date?.toDate().toLocaleString()}</td>
                <td className="px-4 py-3 font-bold text-ink">{money(s.total, currency)}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <Badge tone={s.paymentMethod === 'debt' ? 'danger' : 'primary'}>{paymentLabel(s, wallets, t)}</Badge>
                </td>
                <td className="px-4 py-3 text-sub hidden md:table-cell">{s.soldByName}</td>
                <td className="px-4 py-3">
                  <button onClick={() => onPrint(s)} className="text-sub hover:text-primary">
                    <Printer size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMoreButton hasMore={hasMore} loadingMore={loadingMore} onClick={loadMore} />
    </Card>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-primary text-white' : 'bg-white text-sub border border-line'}`}>
      {children}
    </button>
  );
}
function ChipBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-2 rounded-lg text-xs font-bold ${active ? 'bg-primary text-white' : 'bg-bg text-ink'}`}>
      {children}
    </button>
  );
}
