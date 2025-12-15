import React, { useState } from 'react';

export default function Login({ onSignIn, onSignUp, onForgotPassword, authMessage, authError, signInDebug, forgotCooldown }) {
  const PUBLIC = process.env.PUBLIC_URL || '';
  const bg = `${PUBLIC}/login%20page.jpg`;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const showSignInDebug = process.env.NODE_ENV !== 'production' && signInDebug && typeof signInDebug === 'object' && Object.keys(signInDebug).length > 0;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: `linear-gradient(rgba(255,255,255,0.75), rgba(255,255,255,0.75)), url('${bg}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <div style={{ width: 360, maxWidth: '90%', background: 'rgba(255,255,255,0.96)', padding: 28, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
        <h1 style={{ margin: 0, marginBottom: 6, fontSize: 24 }}>Leafnote</h1>
        <div style={{ marginBottom: 18, color: '#555' }}>A quiet record of your reading</div>

        <label style={{ display: 'block', fontSize: 13, color: '#333', marginBottom: 6 }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@domain.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', marginBottom: 12 }} />

        <label style={{ display: 'block', fontSize: 13, color: '#333', marginBottom: 6 }}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', marginBottom: 12 }} />

        <button onClick={() => onSignIn(email, password)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: '#1a7f37', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Sign in</button>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button onClick={() => onSignUp(email, password)} style={{ background: 'transparent', border: 'none', color: '#1a7f37', cursor: 'pointer', fontWeight: 600 }}>Sign up</button>
          <button
            onClick={() => {
              if (!email || !String(email).trim()) {
                // immediate client-side feedback to help users
                alert('Please enter your email address to reset your password.');
                return;
              }
              if (onForgotPassword) onForgotPassword(email);
            }}
            disabled={forgotCooldown>0}
            style={{ background: 'transparent', border: 'none', color: forgotCooldown>0? '#999' : '#555', cursor: forgotCooldown>0? 'default' : 'pointer', marginLeft: 12 }}
          >
            {forgotCooldown>0 ? `Forgot password (${forgotCooldown}s)` : 'Forgot password'}
          </button>
        </div>

        {(authMessage || authError) ? (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            {authMessage ? <div style={{ color: '#0a7f3b', fontWeight: 600 }}>{authMessage}</div> : null}
            {authError ? <div style={{ color: '#a33', fontWeight: 600 }}>{authError}</div> : null}
          </div>
        ) : null}

        {showSignInDebug ? (
          <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fafafa', padding: 8, borderRadius: 8 }}>{JSON.stringify(signInDebug, null, 2)}</pre>
        ) : null}

        {/* Do not render the global sign-in debug on production builds. */}
      </div>
    </div>
  );
}
