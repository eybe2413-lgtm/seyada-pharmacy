import { doc, collection, runTransaction, serverTimestamp, query, orderBy, limit as fbLimit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { computeLowStock } from './medicineService';
import { statsRef, increment } from './statsService';
import { financeDocRef } from './financeService';
import { logAction } from './auditService';

const PAGE_SIZE = 20;

export async function recordPurchase({ medicineId, newMed, quantity, unitCost, supplier, batchNumber, paymentSource, user }) {
  const total = quantity * unitCost;
  const purRef = doc(collection(db, 'purchases'));
  let medicineName;

  await runTransaction(db, async (tx) => {
    if (medicineId) {
      const medRef = doc(db, 'medicines', medicineId);
      const snap = await tx.get(medRef);
      if (!snap.exists()) throw new Error('الدواء غير موجود');
      const data = snap.data();
      const newQty = data.quantity + quantity;
      medicineName = data.name;
      tx.update(medRef, {
        quantity: newQty,
        costPrice: unitCost,
        isLowStock: computeLowStock(newQty, data.lowStockThreshold),
        updatedAt: serverTimestamp(),
      });
    } else {
      const medRef = doc(collection(db, 'medicines'));
      medicineName = newMed.name;
      tx.set(medRef, {
        name: newMed.name,
        name_lower: newMed.name.toLowerCase(),
        category: newMed.category || '',
        barcode: newMed.barcode || '',
        batchNumber: batchNumber || '',
        supplier: supplier || '',
        quantity,
        sellPrice: newMed.sellPrice || unitCost,
        costPrice: unitCost,
        lowStockThreshold: 10,
        isLowStock: computeLowStock(quantity, 10),
        expiryDate: newMed.expiryDate ? new Date(newMed.expiryDate) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    tx.set(purRef, {
      date: serverTimestamp(),
      medicineId: medicineId || null,
      medicineName,
      quantity,
      unitCost,
      total,
      supplier: supplier || '',
      batchNumber: batchNumber || '',
      paymentSource,
      recordedByUid: user.uid,
      recordedByName: user.name,
      createdAt: serverTimestamp(),
    });

    tx.set(statsRef(), { totalPurchases: increment(total), updatedAt: serverTimestamp() }, { merge: true });

    const field = paymentSource === 'cash' ? 'cash' : 'balances.' + paymentSource;
    tx.set(financeDocRef(), { [field]: increment(-total), updatedAt: serverTimestamp() }, { merge: true });
  });

  logAction({ user, action: 'purchase.create', target: purRef.id, details: `شراء ${medicineName} ×${quantity} بقيمة ${total}` });
}

export async function fetchPurchasesPage({ cursor = null, fromArchive = false } = {}) {
  const colRef = collection(db, fromArchive ? 'purchases_archive' : 'purchases');
  let q = query(colRef, orderBy('date', 'desc'), fbLimit(PAGE_SIZE));
  if (cursor) q = query(colRef, orderBy('date', 'desc'), startAfter(cursor), fbLimit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}