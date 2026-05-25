'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email,    setEmail]       = useState('');
  const [password, setPassword]    = useState('');
  const [showPass, setShowPass]    = useState(false);
  const [error,    setError]       = useState('');
  const [loading,  setLoading]     = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      const meRes = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.user) setUser(meData.user);
      }
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '13px 14px', borderRadius: 6, fontSize: 13,
    border: '1.5px solid #E2E5EA', outline: 'none',
    background: '#F4F6F9', color: '#0F1320',
    boxSizing: 'border-box', transition: 'border-color .15s, background .15s',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Left: Form ── */}
      <div style={{
        width: 560, flexShrink: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 56px', background: '#fff',
      }}>
        {/* Top: Logo */}
        <div>
          <svg width="120" height="48" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1.5" y="1.5" width="97" height="37" rx="3" stroke="#C0202A" strokeWidth="2.5"/>
            <text x="9" y="30" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="26" fill="#0F1320">z</text>
            <text x="34" y="29" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="20" fill="#C0202A">TECH</text>
          </svg>
          <div style={{
            marginTop: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em',
            color: '#8A92A3', textTransform: 'uppercase',
          }}>
            Operations Dashboard
          </div>
        </div>

        {/* Middle: Form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 8 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0F1320', letterSpacing: -0.5, marginBottom: 8 }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 36 }}>
            Enter your credentials to manage your park facilities.
          </p>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Email Address
              </label>
              <input
                type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email address"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#0E7C66'; e.target.style.background = '#fff'; }}
                onBlur={e  => { e.target.style.borderColor = '#E2E5EA'; e.target.style.background = '#F4F6F9'; }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={e => { e.target.style.borderColor = '#0E7C66'; e.target.style.background = '#fff'; }}
                  onBlur={e  => { e.target.style.borderColor = '#E2E5EA'; e.target.style.background = '#F4F6F9'; }}
                />
                <button type="button" onClick={() => setShowPass(s => !s)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: '#9CA3AF', display: 'flex', alignItems: 'center',
                }}>
                  {showPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 6,
                background: '#FEF2F2', color: '#B91C1C',
                fontSize: 12.5, border: '1px solid #FECACA',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '14px 0', borderRadius: 8,
              fontWeight: 700, fontSize: 14,
              background: loading ? '#A7D7CC' : '#0E5C4A',
              color: '#fff', border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .15s',
            }}>
              {loading ? 'Signing in…' : (
                <>
                  Sign In to Dashboard
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Security notice */}
          <div style={{
            marginTop: 24, padding: '14px 16px', borderRadius: 8,
            background: '#EFF6FF', border: '1px solid #DBEAFE',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#DBEAFE',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A5F', marginBottom: 3 }}>Secure administrative access</div>
              <div style={{ fontSize: 11.5, color: '#4B72A8', lineHeight: 1.5 }}>
                This portal is restricted to authorized park personnel. All login attempts and sessions are monitored for security audit purposes.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Footer */}
        <div style={{ fontSize: 12, color: '#9CA3AF' }}>
          Powered by Novostack · v1.0.0
        </div>
      </div>

      {/* ── Right: Park image ── */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
      }}>
        <img
          src="/park-bg.jpg" alt="ZingParks"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left center', display: 'block' }}
        />
        {/* subtle dark overlay so it doesn't overpower */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 100%)',
        }}/>
      </div>
    </div>
  );
}
