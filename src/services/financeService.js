import { doc, getDoc, setDoc, updateDoc, onSnapshot, increment, serverTimestamp, collection, addDoc, getDocs, query, orderBy, where, limit as fbLimit, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

const financeDocRef = () => doc(db, 'finances', 'main');
const walletsColRef = () => collection(db, 'wallets');

export async function ensureFinanceDoc() {
  const snap = await getDoc(financeDocRef());
  if (!snap.exists()) {
    await setDoc(financeDocRef(), { cash: 0, balances: {}, updatedAt: serverTimestamp() });
  }
}

export async function ensureDefaultWallets() {
  const snap = await getDocs(walletsColRef());
  if (!snap.empty) return;
  const defaults = ['Bankily', 'Masrifi', 'Sidad'];
  const batch = writeBatch(db);
  const balances = {};
  defaults.forEach((name) => {
    const ref = doc(walletsColRef());
    batch.set(ref, { name, createdAt: serverTimestamp() });
    balances[ref.id] = 0;
  });
  batch.set(financeDocRef(), { balances }, { merge: true });
  await batch.commit();
}

export async function fetchWallets() {
  const snap = await getDocs(query(walletsColRef(), orderBy('createdAt')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addWallet(name) {
  const ref = doc(walletsColRef());
  const batch = writeBatch(db);
  batch.set(ref, { name, createdAt: serverTimestamp() });
  batch.update(financeDocRef(), { ['balances.' + ref.id]: 0 });
  await batch.commit();
  return ref.id;
}

export async function fetchFinances() {
  const snap = await getDoc(financeDocRef());
  return snap.exists() ? { cash: 0, balances: {}, ...snap.data() } : { cash: 0, balances: {} };
}

export async function setCashBalance(value) {
  await setDoc(financeDocRef(), { cash: value, updatedAt: serverTimestamp() }, { merge: true });
}

export async function setWalletBalance(walletId, value) {
  await updateDoc(financeDocRef(), { ['balances.' + walletId]: value, updatedAt: serverTimestamp() });
}

export async function adjustFinanceSource(source, amount) {
  const field = source === 'cash' ? 'cash' : 'balances.' + source;
  await updateDoc(financeDocRef(), { [field]: increment(amount), updatedAt: serverTimestamp() });
}

export { financeDocRef };

export function subscribeFinances(callback) {
  return onSnapshot(financeDocRef(), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      callback({ cash: d.cash || 0, balances: d.balances || {} });
    }
  });
}

export async function deduplicateWallets() {
  const snap = await getDocs(query(walletsColRef(), orderBy('createdAt')));
  const seen = new Map();
  const batch = writeBatch(db);
  let hasDups = false;
  snap.docs.forEach((d) => {
    const name = d.data().name?.toLowerCase();
    if (name && seen.has(name)) {
      batch.delete(d.ref);
      hasDups = true;
    } else if (name) {
      seen.set(name, d.id);
    }
  });
  if (hasDups) await batch.commit();
}

export async function fetchWalletTransactions(source) {
  const salesQ = query(collection(db, 'sales'), where('paymentMethod', '==', source === 'cash' ? 'cash' : source), orderBy('date', 'desc'), fbLimit(15));
  const purchasesQ = query(collection(db, 'purchases'), where('paymentSource', '==', source), orderBy('date', 'desc'), fbLimit(15));
  const expensesQ = query(collection(db, 'expenses'), where('paymentSource', '==', source), orderBy('date', 'desc'), fbLimit(15));

  const [salesSnap, purchasesSnap, expensesSnap] = await Promise.all([
    getDocs(salesQ),
    getDocs(purchasesQ),
    getDocs(expensesQ),
  ]);

  const rows = [
    ...salesSnap.docs.map((d) => ({ id: d.id, type: 'sale', amount: d.data().total, date: d.data().date, label: 'بيع' })),
    ...purchasesSnap.docs.map((d) => ({ id: d.id, type: 'purchase', amount: -d.data().total, date: d.data().date, label: d.data().medicineName })),
    ...expensesSnap.docs.map((d) => ({ id: d.id, type: 'expense', amount: -d.data().amount, date: d.data().date, label: d.data().category })),
  ];

  return rows.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0)).slice(0, 20);
}
