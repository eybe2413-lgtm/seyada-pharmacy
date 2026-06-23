import { collection, doc, addDoc, getDocs, query, orderBy, startAt, endAt, limit as fbLimit, startAfter, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchDebtPayments } from './debtService';
import { logAction } from './auditService';

const PAGE_SIZE = 20;
const col = () => collection(db, 'customers');

export async function addCustomer({ name, phone, address, user }) {
  const ref = await addDoc(col(), {
    name,
    name_lower: name.toLowerCase(),
    phone: phone || '',
    address: address || '',
    createdByUid: user.uid,
    createdAt: serverTimestamp(),
  });
  logAction({ user, action: 'customer.create', target: name });
  return ref.id;
}

export async function fetchCustomersPage(cursor = null) {
  let q = query(col(), orderBy('name_lower'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(col(), orderBy('name_lower'), startAfter(cursor), fbLimit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function searchCustomers(text) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const snap = await getDocs(query(col(), orderBy('name_lower'), startAt(q), endAt(q + '\uf8ff'), fbLimit(15)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// كشف حساب العميل: every debt tied to this phone number (the identifier
// already captured on every debt, including ones created from the Sales
// checkout flow before the Customers module existed) plus its full payment
// history, so the statement covers historical data too — not just debts
// created from this screen going forward.
export async function fetchCustomerStatement(phone) {
  if (!phone) return { debts: [], totalOriginal: 0, totalOwed: 0, totalPaid: 0 };
  const snap = await getDocs(query(collection(db, 'debts'), where('phone', '==', phone), orderBy('date', 'desc')));
  const debts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const debtsWithPayments = await Promise.all(
    debts.map(async (d) => ({ ...d, payments: await fetchDebtPayments(d.id) }))
  );
  const totalOriginal = debtsWithPayments.reduce((a, d) => a + (d.originalAmount || d.amount || 0), 0);
  const totalOwed = debtsWithPayments.reduce((a, d) => a + (d.amount || 0), 0);
  const totalPaid = totalOriginal - totalOwed;
  return { debts: debtsWithPayments, totalOriginal, totalOwed, totalPaid };
}
