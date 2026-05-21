import Link from 'next/link';

export const metadata = { title: 'Page Not Found — ZTech' };

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#F4F6F9', padding: '24px',
    }}>
      <svg width="100" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 32 }}>
        <rect x="1.5" y="1.5" width="97" height="37" rx="3" stroke="#C0202A" strokeWidth="2.5"/>
        <text x="9" y="30" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="26" fill="#0F1320">z</text>
        <text x="34" y="29" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="20" fill="#C0202A">TECH</text>
      </svg>

      <div style={{
        fontSize: 80, fontWeight: 900, color: '#E5E7EB',
        letterSpacing: -4, lineHeight: 1, marginBottom: 8,
      }}>
        404
      </div>

      <h1 style={{
        fontSize: 22, fontWeight: 700, color: '#0F1320',
        marginBottom: 8, textAlign: 'center',
      }}>
        Page not found
      </h1>

      <p style={{
        fontSize: 14, color: '#6B7280', marginBottom: 32,
        textAlign: 'center', maxWidth: 340, lineHeight: 1.6,
      }}>
        The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
      </p>

      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '12px 24px', borderRadius: 8,
        background: '#0E5C4A', color: '#fff',
        fontSize: 14, fontWeight: 700, textDecoration: 'none',
      }}>
        Back to Dashboard
      </Link>
    </div>
  );
}
