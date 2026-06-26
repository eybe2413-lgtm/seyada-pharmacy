import { doc, getDoc, setDoc, runTransaction, serverTimestamp, collection, query, where, getDocs, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { financeDocRef } from './financeService';
import { logAction } from './auditService';

const docId = (employeeUid, month) => `${employeeUid}_${month}`;

export async function setMonthlySalary(employeeUid, employeeName, month, salaryAmount) {
  const ref = doc(db, 'salaries', docId(employeeUid, month));
  const snap = await getDoc(ref);
  const paidAmount = snap.exists() ? snap.data().paidAmount || 0 : 0;
  await setDoc(
    ref,
    {
      employeeUid,
      employeeName,
      month,
      salaryAmount,
      paidAmount,
      remaining: Math.max(0, salaryAmount - paidAmount),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function fetchSalariesForMonth(month) {
  const snap = await getDocs(query(collection(db, 'salaries'), where('month', '==', month)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function paySalaryInstallment({ employeeUid, employeeName, month, amount, source, user }) {
  const ref = doc(db, 'salaries', docId(employeeUid, month));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : { salaryAmount: 0, paidAmount: 0 };
    const newPaid = (data.paidAmount || 0) + amount;
    tx.set(
      ref,
      {
        employeeUid,
        employeeName,
        month,
        salaryAmount: data.salaryAmount || 0,
        paidAmount: newPaid,
        remaining: Math.max(0, (data.salaryAmount || 0) - newPaid),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    // التعديل ٩: خصم الراتب من المحفظة المختارة
    const field = source === 'cash' ? 'cash' : 'balances.' + source;
    tx.set(financeDocRef(), { [field]: increment(-amount), updatedAt: serverTimestamp() }, { merge: true });
  });

  logAction({ user, action: 'salary.pay', target: employeeName, details: `دفعة راتب ${amount} لشهر ${month}` });
}
