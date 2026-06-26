import { doc, collection, runTransaction, serverTimestamp, query, orderBy, limit as fbLimit, startAfter, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { computeLowStock } from './medicineService';
import { statsRef, costStatsRef, increment } from './statsService';
import { financeDocRef } from './financeService';
import { logAction } from './auditService';

const PAGE_SIZE = 20;

export async function recordSale({ cart, paymentMethod, customer, walletId, discount = 0, user }) {
  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const safeDiscount = Math.max(0, Math.min(Number(discount) || 0, subtotal));
  const total = subtotal - safeDiscount;
  const saleRef = doc(collection(db, 'sales'));
  const debtRef = paymentMethod === 'debt' ? doc(collection(db, 'debts')) : null;

  await runTransaction(db, async (tx) => {
    const medRefs = cart.map((i) => doc(db, 'medicines', i.medicineId));
    const medSnaps = await Promise.all(medRefs.map((r) => tx.get(r)));

    let costOfGoods = 0;
    medSnaps.forEach((snap, idx) => {
      if (!snap.exists()) throw new Error('دواء غير موجود: ' + cart[idx].name);
      const data = snap.data();
      const newQty = data.quantity - cart[idx].qty;
      if (newQty < 0) throw new Error('الكمية غير متوفرة لـ ' + cart[idx].name);
      costOfGoods += (data.costPrice || 0) * cart[idx].qty;
      tx.update(medRefs[idx], {
        quantity: newQty,
        isLowStock: computeLowStock(newQty, data.lowStockThreshold),
        updatedAt: serverTimestamp(),
      });
    });

    tx.set(saleRef, {
      date: serverTimestamp(),
      items: cart,
      subtotal,
      discount: safeDiscount,
      total,
      paymentMethod,
      walletId: walletId || null,
      customerName: paymentMethod === 'debt' ? customer.name : customer?.name || null,
      customerPhone: paymentMethod === 'debt' ? customer.phone || '' : customer?.phone || null,
      soldByUid: user.uid,
      soldByName: user.name,
      createdAt: serverTimestamp(),
    });

    tx.set(statsRef(), { totalSales: increment(total), saleCount: increment(1), updatedAt: serverTimestamp() }, { merge: true });
    tx.set(costStatsRef(), { totalCostOfGoods: increment(costOfGoods), updatedAt: serverTimestamp() }, { merge: true });

    if (paymentMethod === 'debt') {
      tx.set(debtRef, {
        personName: customer.name,
        personName_lower: customer.name.toLowerCase(),
        phone: customer.phone || '',
        address: customer.address || '',
        amount: total,
        originalAmount: total,
        date: serverTimestamp(),
        description: 'بيع آجل: ' + cart.map((i) => `${i.name} ×${i.qty}`).join('، '),
        paid: false,
        createdAt: serverTimestamp(),
      });
    } else {
      const field = paymentMethod === 'cash' ? 'cash' : 'balances.' + walletId;
      tx.update(financeDocRef(), { [field]: increment(total), updatedAt: serverTimestamp() });
    }
  });

  logAction({ user, action: 'sale.create', target: saleRef.id, details: `بيع بقيمة ${total}${safeDiscount ? ` (خصم ${safeDiscount})` : ''}` });
  return { id: saleRef.id, subtotal, discount: safeDiscount, total };
}

export async function fetchSalesPage({ cursor = null, fromArchive = false } = {}) {
  const colRef = collection(db, fromArchive ? 'sales_archive' : 'sales');
  let q = query(colRef, orderBy('date', 'desc'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(colRef, orderBy('date', 'desc'), startAfter(cursor), fbLimit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function fetchSalesByDateRange(start, end) {
  const q = query(collection(db, 'sales'), where('date', '>=', start), where('date', '<', end), orderBy('date', 'desc'), fbLimit(500));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
