import { doc, collection, runTransaction, serverTimestamp, query, orderBy, limit as fbLimit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { statsRef, increment } from './statsService';
import { financeDocRef } from './financeService';
import { logAction } from './auditService';

// التعديل ٨: إضافة "الإيجار الشهري"
export const EXPENSE_CATEGORIES = ['electricity', 'water', 'internet', 'breakfast', 'lunch', 'taxi', 'maintenance', 'rent', 'other'];
const PAGE_SIZE = 20;

export async function recordExpense({ category, amount, description, paymentSource, user }) {
  const expRef = doc(collection(db, 'expenses'));

  await runTransaction(db, async (tx) => {
    tx.set(expRef, {
      date: serverTimestamp(),
      category,
      amount,
      description: description || '',
      paymentSource,
      recordedByUid: user.uid,
      recordedByName: user.name,
      createdAt: serverTimestamp(),
    });
    tx.set(statsRef(), { totalExpenses: increment(amount), updatedAt: serverTimestamp() }, { merge: true });
    // التعديل ٤: خصم النفقة من المحفظة أو الرصيد النقدي
    const field = paymentSource === 'cash' ? 'cash' : 'balances.' + paymentSource;
    tx.set(financeDocRef(), { [field]: increment(-amount), updatedAt: serverTimestamp() }, { merge: true });
  });

  logAction({ user, action: 'expense.create', target: expRef.id, details: `${category}: ${amount}` });
}

export async function fetchExpensesPage({ cursor = null, fromArchive = false } = {}) {
  const colRef = collection(db, fromArchive ? 'expenses_archive' : 'expenses');
  let q = query(colRef, orderBy('date', 'desc'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(colRef, orderBy('date', 'desc'), startAfter(cursor), fbLimit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function fetchExpensesByDateRange(start, end) {
  const q = query(collection(db, 'expenses'), where('date', '>=', start), where('date', '<', end), orderBy('date', 'desc'), fbLimit(500));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
