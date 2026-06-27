import {
  doc,
  collection,
  addDoc,
  runTransaction,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit as fbLimit,
  startAfter,
  getDocs,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { financeDocRef } from './financeService';
import { logAction } from './auditService';

const PAGE_SIZE = 20;
const col = () => collection(db, 'debts');

export async function addDebtManual({ personName, phone, address, amount, description, user }) {
  const ref = await addDoc(col(), {
    personName,
    personName_lower: personName.toLowerCase(),
    phone: phone || '',
    address: address || '',
    amount,
    originalAmount: amount,
    date: serverTimestamp(),
    description: description || '',
    paid: false,
    createdAt: serverTimestamp(),
  });
  logAction({ user, action: 'debt.create', target: ref.id, details: `${personName}: ${amount}` });
}

export async function addDebtPayment({ debtId, amount, source, user }) {
  const debtRef = doc(db, 'debts', debtId);
  const paymentRef = doc(collection(db, 'debts', debtId, 'payments'));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(debtRef);
    if (!snap.exists()) throw new Error('الدين غير موجود');
    const data = snap.data();
    const remaining = Math.max(0, data.amount - amount);
    tx.update(debtRef, { amount: remaining, paid: remaining <= 0, updatedAt: serverTimestamp() });
    tx.set(paymentRef, { amount, source, date: serverTimestamp(), recordedByUid: user.uid, recordedByName: user.name });
    const field = source === 'cash' ? 'cash' : 'balances.' + source;
    tx.set(financeDocRef(), { [field]: increment(-amount), updatedAt: serverTimestamp() }, { merge: true });
  });

  logAction({ user, action: 'debt.payment', target: debtId, details: `دفعة ${amount}` });
}

export async function fetchDebtPayments(debtId) {
  const snap = await getDocs(query(collection(db, 'debts', debtId, 'payments'), orderBy('date', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchUnpaidDebtsPage({ cursor = null } = {}) {
  let q = query(col(), where('paid', '==', false), orderBy('date', 'desc'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(col(), where('paid', '==', false), orderBy('date', 'desc'), startAfter(cursor), fbLimit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function fetchAllDebtsPage({ cursor = null } = {}) {
  let q = query(col(), orderBy('date', 'desc'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(col(), orderBy('date', 'desc'), startAfter(cursor), fbLimit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function fetchTotalUnpaidDebt() {
  const snap = await getDocs(query(col(), where('paid', '==', false)));
  return snap.docs.reduce((a, d) => a + (d.data().amount || 0), 0);
}

export async function searchDebts(term) {
  const lower = term.toLowerCase();
  const snap = await getDocs(
    query(col(), where('personName_lower', '>=', lower), where('personName_lower', '<=', lower + ''), fbLimit(20))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
