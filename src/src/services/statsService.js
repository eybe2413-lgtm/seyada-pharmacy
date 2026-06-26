import { doc, getDoc, increment, serverTimestamp, collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function dayId(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
export function monthId(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

const EMPTY = { totalSales: 0, saleCount: 0, totalPurchases: 0, totalExpenses: 0 };

export async function fetchTodayStats() {
  const snap = await getDoc(doc(db, 'daily_stats', dayId()));
  return snap.exists() ? { ...EMPTY, ...snap.data() } : EMPTY;
}

export async function fetchTodayCost() {
  const snap = await getDoc(doc(db, 'daily_cost_stats', dayId()));
  return snap.exists() ? snap.data().totalCostOfGoods || 0 : 0;
}

// Range query on document ID (sortable 'YYYY-MM-DD' strings) — pulls any
// period (week/month/year) with a handful of cheap reads instead of
// aggregating raw transactions client-side.
export async function fetchStatsRange(startDate, endDate) {
  const q = query(collection(db, 'daily_stats'), where(documentId(), '>=', dayId(startDate)), where(documentId(), '<=', dayId(endDate)));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...EMPTY, ...d.data() }));
}

export async function fetchCostRange(startDate, endDate) {
  const q = query(collection(db, 'daily_cost_stats'), where(documentId(), '>=', dayId(startDate)), where(documentId(), '<=', dayId(endDate)));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, totalCostOfGoods: d.data().totalCostOfGoods || 0 }));
}

export async function fetchLast7DaysStats() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const rows = await fetchStatsRange(start, end);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const id = dayId(d);
    result.push({ id, label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), ...(byId[id] || EMPTY) });
  }
  return result;
}

// Helper refs used by other services so they can fold counter updates into
// their own transaction (sales/purchases/expenses write the public doc;
// sales also writes the cost-of-goods doc separately).
export function statsRef(date = new Date()) {
  return doc(db, 'daily_stats', dayId(date));
}
export function costStatsRef(date = new Date()) {
  return doc(db, 'daily_cost_stats', dayId(date));
}
export { increment, serverTimestamp };
