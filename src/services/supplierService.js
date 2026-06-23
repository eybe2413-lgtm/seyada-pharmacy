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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logAction } from './auditService';

const PAGE_SIZE = 20;
const col = () => collection(db, 'suppliers');

export async function saveSupplier(data, user) {
  const payload = {
    name: data.name,
    name_lower: data.name.toLowerCase(),
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    notes: data.notes || '',
    updatedAt: serverTimestamp(),
  };

  if (data.id) {
    await updateDoc(doc(col(), data.id), payload);
    logAction({ user, action: 'supplier.update', target: data.name });
    return data.id;
  } else {
    payload.createdAt = serverTimestamp();
    payload.createdByUid = user.uid;
    const ref = await addDoc(col(), payload);
    logAction({ user, action: 'supplier.create', target: data.name });
    return ref.id;
  }
}

export async function deleteSupplier(id, name, user) {
  await deleteDoc(doc(col(), id));
  logAction({ user, action: 'supplier.delete', target: name });
}

export async function fetchSuppliersPage(cursor = null) {
  let q = query(col(), orderBy('name_lower'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(col(), orderBy('name_lower'), startAfter(cursor), fbLimit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function searchSuppliers(text) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const snap = await getDocs(
    query(col(), orderBy('name_lower'), startAt(q), endAt(q + '\uf8ff'), fbLimit(15))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchAllSuppliers() {
  const snap = await getDocs(query(col(), orderBy('name_lower')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
