import {
  doc, getDoc, setDoc, updateDoc, deleteField, increment,
  serverTimestamp, collection, getDocs, query, orderBy,
  where, limit as fbLimit, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const financeDocRef = () => doc(db, 'finances', 'main');
const walletsColRef = () => collection(db, 'wallets');

// ── Bootstrap ──────────────────────────────────────────────────────────────

export async function ensureFinanceDoc() {
  await setDoc(financeDocRef(), { cash: 0, balances: {}, updatedAt: serverTimestamp() }, { merge: true });
}

// Creates the three Mauritanian e-wallet defaults if they don't exist yet.
// Checks by NAME (not by collection count) so concurrent calls can't
// create duplicates even if two browser tabs race on first load.
export async function ensureDefaultWallets() {
  await ensureFinanceDoc();

  const snap = await getDocs(walletsColRef());
  const existingNames = new Set(snap.docs.map((d) => d.data().name));

  // Rename any old English names that may exist from a previous install
  const RENAME = { Bankily: 'بنكيلي', Masrifi: 'مصرفي', Sidad: 'السداد' };
  const toRename = snap.docs.filter((d) => RENAME[d.data().name]);
  if (toRename.length > 0) {
    const b = writeBatch(db);
    toRename.forEach((d) => {
      const newName = RENAME[d.data().name];
      b.update(d.ref, { name: newName });
      existingNames.delete(d.data().name);
      existingNames.add(newName);
    });
    await b.commit();
  }

  const DEFAULTS = ['بنكيلي', 'مصرفي', 'السداد'];
  const toCreate = DEFAULTS.filter((name) => !existingNames.has(name));
  if (toCreate.length === 0) return; // كل المحافظ موجودة بالفعل

  const batch = writeBatch(db);
  const balances = {};
  toCreate.forEach((name) => {
    const ref = doc(walletsColRef());
    batch.set(ref, { name, createdAt: serverTimestamp() });
    balances[ref.id] = 0;
  });
  batch.set(financeDocRef(), { balances }, { merge: true });
  await batch.commit();
}

// Removes duplicate wallets (same name → keep the one with the highest
// balance, delete the rest and purge their IDs from finances/main).
export async function deduplicateWallets() {
  const [walletsSnap, finances] = await Promise.all([
    getDocs(query(walletsColRef(), orderBy('createdAt'))),
    fetchFinances(),
  ]);

  // Group by name
  const byName = {};
  walletsSnap.docs.forEach((d) => {
    const name = d.data().name;
    if (!byName[name]) byName[name] = [];
    byName[name].push({ id: d.id, ref: d.ref, balance: finances.balances?.[d.id] || 0 });
  });

  const toDelete = [];
  Object.values(byName).forEach((group) => {
    if (group.length <= 1) return;
    // Keep the one with the highest balance (usually the first-created one)
    group.sort((a, b) => b.balance - a.balance);
    toDelete.push(...group.slice(1));
  });

  if (toDelete.length === 0) return 0;

  const batch = writeBatch(db);
  const balanceUpdates = {};
  toDelete.forEach(({ id, ref }) => {
    batch.delete(ref);
    balanceUpdates[`balances.${id}`] = deleteField();
  });
  await batch.commit();
  await updateDoc(financeDocRef(), balanceUpdates);
  return toDelete.length;
}

// ── Wallets CRUD ──────────────────────────────────────────────────────────

export async function fetchWallets() {
  const snap = await getDocs(query(walletsColRef(), orderBy('createdAt')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addWallet(name) {
  // Prevent duplicates by name
  const snap = await getDocs(walletsColRef());
  const exists = snap.docs.some((d) => d.data().name === name.trim());
  if (exists) throw new Error(`محفظة باسم "${name}" موجودة بالفعل`);

  const ref = doc(walletsColRef());
  const batch = writeBatch(db);
  batch.set(ref, { name: name.trim(), createdAt: serverTimestamp() });
  batch.set(financeDocRef(), { [`balances.${ref.id}`]: 0 }, { merge: true });
  await batch.commit();
  return ref.id;
}

export async function deleteWalletDoc(walletId) {
  const batch = writeBatch(db);
  batch.delete(doc(walletsColRef(), walletId));
  const balanceUpdates = { [`balances.${walletId}`]: deleteField() };
  await batch.commit();
  await updateDoc(financeDocRef(), balanceUpdates);
}

// ── Finance ───────────────────────────────────────────────────────────────

export async function fetchFinances() {
  const snap = await getDoc(financeDocRef());
  return snap.exists() ? { cash: 0, balances: {}, ...snap.data() } : { cash: 0, balances: {} };
}

export async function setCashBalance(value) {
  await setDoc(financeDocRef(), { cash: value, updatedAt: serverTimestamp() }, { merge: true });
}

export async function setWalletBalance(walletId, value) {
  await setDoc(financeDocRef(), { [`balances.${walletId}`]: value, updatedAt: serverTimestamp() }, { merge: true });
}

export async function adjustFinanceSource(source, amount) {
  const field = source === 'cash' ? 'cash' : `balances.${source}`;
  await setDoc(financeDocRef(), { [field]: increment(amount), updatedAt: serverTimestamp() }, { merge: true });
}

export { financeDocRef };

// ── Wallet transaction history ────────────────────────────────────────────

export async function fetchWalletTransactions(source) {
  const salesQ     = query(collection(db, 'sales'),     where('paymentMethod', '==', source), orderBy('date', 'desc'), fbLimit(15));
  const purchasesQ = query(collection(db, 'purchases'), where('paymentSource', '==', source), orderBy('date', 'desc'), fbLimit(15));
  const expensesQ  = query(collection(db, 'expenses'),  where('paymentSource', '==', source), orderBy('date', 'desc'), fbLimit(15));

  const [s, p, e] = await Promise.all([getDocs(salesQ), getDocs(purchasesQ), getDocs(expensesQ)]);

  return [
    ...s.docs.map((d) => ({ id: d.id, type: 'sale',     amount:  d.data().total,   date: d.data().date, label: 'بيع' })),
    ...p.docs.map((d) => ({ id: d.id, type: 'purchase', amount: -d.data().total,   date: d.data().date, label: d.data().medicineName })),
    ...e.docs.map((d) => ({ id: d.id, type: 'expense',  amount: -d.data().amount,  date: d.data().date, label: d.data().category })),
  ]
    .sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0))
    .slice(0, 25);
}
