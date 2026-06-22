import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit as fbLimit,
  startAfter,
  startAt,
  endAt,
  where,
  Timestamp,
  serverTimestamp,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cacheGet, cacheSet, cacheInvalidate } from './cache';
import { logAction } from './auditService';

const PAGE_SIZE = 20;
const col = () => collection(db, 'medicines');

export function computeLowStock(quantity, threshold) {
  return quantity <= (threshold ?? 10);
}

export async function fetchMedicinesPage(cursor = null) {
  let q = query(col(), orderBy('name_lower'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(col(), orderBy('name_lower'), startAfter(cursor), fbLimit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function searchMedicinesByName(text) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const snap = await getDocs(query(col(), orderBy('name_lower'), startAt(q), endAt(q + '\uf8ff'), fbLimit(15)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function searchMedicinesByScientificName(text) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const snap = await getDocs(query(col(), orderBy('scientificName_lower'), startAt(q), endAt(q + '\uf8ff'), fbLimit(15)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Searches both the trade name and the scientific/generic name in parallel
// and merges the results (deduplicated). This is what every search box in
// the app should call — "Paracétamol" and "Acétaminophène" should both find
// the same product.
export async function searchMedicines(text) {
  const q = text.trim();
  if (!q) return [];
  const [byName, byScientific] = await Promise.all([searchMedicinesByName(q), searchMedicinesByScientificName(q)]);
  const merged = new Map();
  [...byName, ...byScientific].forEach((m) => merged.set(m.id, m));
  return Array.from(merged.values());
}

export async function findMedicineByBarcode(code) {
  const snap = await getDocs(query(col(), where('barcode', '==', code.trim()), fbLimit(1)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function fetchLowStockMedicines() {
  const cacheKey = 'lowstock';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const snap = await getDocs(query(col(), where('isLowStock', '==', true), orderBy('name_lower'), fbLimit(50)));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, items, 60000);
  return items;
}

export async function fetchExpiringMedicines(daysAhead = 30) {
  const cacheKey = 'expiring_' + daysAhead;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const now = Timestamp.now();
  const cutoff = Timestamp.fromMillis(now.toMillis() + daysAhead * 86400000);
  const snap = await getDocs(query(col(), where('expiryDate', '>=', now), where('expiryDate', '<=', cutoff), orderBy('expiryDate'), fbLimit(50)));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, items, 60000);
  return items;
}

export async function fetchExpiredMedicines() {
  const cacheKey = 'expired';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const now = Timestamp.now();
  const snap = await getDocs(query(col(), where('expiryDate', '<', now), orderBy('expiryDate'), fbLimit(50)));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  cacheSet(cacheKey, items, 60000);
  return items;
}

// Generates a valid, scannable EAN-13 barcode for medicines that don't have
// a manufacturer barcode yet. Uses the "20" prefix, which GS1 reserves for
// internal/in-store use, so generated codes can never collide with a real
// registered product barcode.
export function generateEan13Barcode() {
  let digits = '20';
  for (let i = 0; i < 10; i++) digits += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return digits + checkDigit;
}

export async function saveMedicine(med) {
  const quantity = Number(med.quantity) || 0;
  const lowStockThreshold =
    med.lowStockThreshold === '' || med.lowStockThreshold === null || med.lowStockThreshold === undefined
      ? 10
      : Number(med.lowStockThreshold);

  const payload = {
    name: med.name,
    name_lower: med.name.toLowerCase(),
    scientificName: med.scientificName || '',
    scientificName_lower: (med.scientificName || '').toLowerCase(),
    category: med.category || '',
    barcode: med.barcode || '',
    batchNumber: med.batchNumber || '',
    supplier: med.supplier || '',
    quantity,
    sellPrice: Number(med.sellPrice) || 0,
    costPrice: Number(med.costPrice) || 0,
    lowStockThreshold,
    isLowStock: computeLowStock(quantity, lowStockThreshold),
    expiryDate: med.expiryDate ? Timestamp.fromDate(new Date(med.expiryDate)) : null,
    updatedAt: serverTimestamp(),
  };

  if (med.id) {
    await updateDoc(doc(col(), med.id), payload);
  } else {
    payload.createdAt = serverTimestamp();
    await addDoc(col(), payload);
  }
  cacheInvalidate('lowstock');
  cacheInvalidate('expiring');
  cacheInvalidate('expired');
}

export async function deleteMedicine(id) {
  await deleteDoc(doc(col(), id));
  cacheInvalidate('lowstock');
}

export async function fetchAllMedicinesForValuation() {
  // Used for the inventory-value KPI / inventory report. For extremely
  // large catalogs this could be replaced with a maintained running total,
  // but a single full read here is acceptable since it only runs on demand
  // (Reports screen), not on every dashboard load.
  const snap = await getDocs(col());
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Applies a full stock-take session (جرد المخزون): every row whose counted
// quantity differs from the system quantity gets updated in one batch, and
// the whole session (with each variance) is recorded as a stock_takes
// document so managers can review past counts later.
export async function saveStockTakeSession(changedItems, user) {
  if (changedItems.length === 0) return;
  const CHUNK = 400;
  for (let i = 0; i < changedItems.length; i += CHUNK) {
    const chunk = changedItems.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      batch.update(doc(col(), item.medicineId), {
        quantity: item.countedQty,
        isLowStock: computeLowStock(item.countedQty, item.lowStockThreshold),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  const sessionRef = doc(collection(db, 'stock_takes'));
  await setDoc(sessionRef, {
    date: serverTimestamp(),
    performedByUid: user.uid,
    performedByName: user.name,
    itemCount: changedItems.length,
    totalVariance: changedItems.reduce((a, i) => a + (i.countedQty - i.systemQty), 0),
    items: changedItems.map((i) => ({
      medicineId: i.medicineId,
      medicineName: i.medicineName,
      systemQty: i.systemQty,
      countedQty: i.countedQty,
      variance: i.countedQty - i.systemQty,
    })),
  });

  cacheInvalidate('lowstock');
  cacheInvalidate('expiring');
  cacheInvalidate('expired');
  logAction({ user, action: 'stocktake.session', target: `${changedItems.length} دواء`, details: 'جرد المخزون' });
}

export async function fetchStockTakeSessions() {
  const snap = await getDocs(query(collection(db, 'stock_takes'), orderBy('date', 'desc'), fbLimit(20)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
