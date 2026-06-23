import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, updateDoc, getDocs, collection, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, getSecondaryAuth } from '../lib/firebase';
import { logAction } from './auditService';

export async function createStaffAccount({ email, password, name, role, actingUser }) {
  const secondaryAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
  const uid = cred.user.uid;
  await signOut(secondaryAuth);

  await setDoc(doc(db, 'users', uid), {
    name,
    email: email.trim(),
    role, // 'manager' | 'employee'
    active: true,
    createdAt: serverTimestamp(),
  });

  logAction({ user: actingUser, action: 'user.create', target: name, details: role });
  return uid;
}

export async function deactivateUser(uid, actingUser, targetName) {
  await updateDoc(doc(db, 'users', uid), { active: false });
  logAction({ user: actingUser, action: 'user.deactivate', target: targetName });
}

export async function reactivateUser(uid, actingUser, targetName) {
  await updateDoc(doc(db, 'users', uid), { active: true });
  logAction({ user: actingUser, action: 'user.reactivate', target: targetName });
}

export async function updateUserRole(uid, role, actingUser, targetName) {
  await updateDoc(doc(db, 'users', uid), { role });
  logAction({ user: actingUser, action: 'user.roleChange', target: targetName, details: role });
}

export async function fetchAllUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
