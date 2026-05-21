'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AuthProvider({ children }) {
  const router = useRouter();
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => { if (d?.user) setUser(d.user); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const can = (perm) => Boolean(user?.permissions?.includes(perm));

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#F4F6F9', zIndex: 9999,
      }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 16 }}>
            <rect x="1.5" y="1.5" width="97" height="37" rx="3" stroke="#C0202A" strokeWidth="2.5"/>
            <text x="9" y="30" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="26" fill="#0F1320">z</text>
            <text x="34" y="29" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="20" fill="#C0202A">TECH</text>
          </svg>
          <div style={{
            width: 32, height: 32, margin: '0 auto',
            border: '3px solid #E5E7EB', borderTopColor: '#0E5C4A',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }}/>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, can, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
