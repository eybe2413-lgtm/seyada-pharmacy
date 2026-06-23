import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

// Maps a raw Firebase error to something a non-technical pharmacy manager can
// actually act on, instead of a silent failure or a raw error code.
function describeAuthError(e) {
  const code = e?.code || '';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'تعذر الوصول إلى قاعدة البيانات (Firestore). الأرجح أن قواعد الأمان لم تُنشر بعد — نفّذ: firebase deploy --only firestore:rules,firestore:indexes';
  }
  if (code === 'unavailable') {
    return 'تعذر الاتصال بالخادم — تحقق من اتصال الإنترنت وحاول مجدداً.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return null; // handled separately as a normal "wrong email/password" case
  }
  return e?.message || 'حدث خطأ غير متوقع.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setAuthError('');
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (!snap.exists()) {
          setAuthError('تم تسجيل الدخول في Firebase Authentication، لكن لا يوجد مستند مطابق في users/{uid} داخل Firestore. راجع خطوة "إنشاء أول حساب مدير" في README.');
          await signOut(auth);
          setUser(null);
        } else if (snap.data().active === false) {
          setAuthError('هذا الحساب معطّل من قبل المدير.');
          await signOut(auth);
          setUser(null);
        } else {
          setUser({ uid: fbUser.uid, email: fbUser.email, ...snap.data() });
        }
      } catch (e) {
        console.error('Auth/Firestore error while resolving user role:', e);
        setAuthError(describeAuthError(e) || 'حدث خطأ غير متوقع أثناء تسجيل الدخول.');
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  async function login(email, password) {
    setAuthError('');
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }

  async function logout() {
    await signOut(auth);
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email.trim());
  }

  async function changeOwnPassword(currentPassword, newPassword) {
    const current = auth.currentUser;
    if (!current) throw new Error('no-user');
    const cred = EmailAuthProvider.credential(current.email, currentPassword);
    await reauthenticateWithCredential(current, cred);
    await updatePassword(current, newPassword);
  }

  const value = {
    user,
    loading,
    authError,
    isManager: user?.role === 'manager' || user?.role === 'admin',
    login,
    logout,
    resetPassword,
    changeOwnPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
