import { collection, addDoc, serverTimestamp, query, where, orderBy, limit as fbLimit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PAGE_SIZE = 30;

// Call from within (or right after) the relevant operation. Kept as a
// plain addDoc (not part of the calling transaction) so a logging failure
// never blocks the actual business operation from completing.
export async function logAction({ user, action, target, details }) {
  try {
    await addDoc(collection(db, 'audit_log'), {
      userId: user.uid,
      userName: user.name,
      action,
      target: target || '',
      details: details || '',
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn('audit log write failed', e);
  }
}

export async function fetchAuditLogPage({ cursor = null, userId = null } = {}) {
  const col = collection(db, 'audit_log');
  let q = userId
    ? query(col, where('userId', '==', userId), orderBy('timestamp', 'desc'), fbLimit(PAGE_SIZE))
    : query(col, orderBy('timestamp', 'desc'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}
