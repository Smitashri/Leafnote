import React from 'react';

export default function Consent() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const clientId = params.get('client_id') || params.get('clientId') || '';
  const redirect = params.get('redirect_uri') || params.get('redirect') || '';
  const scope = params.get('scope') || '';
  const state = params.get('state') || '';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6faf6' }}>
      <div style={{ width: 720, maxWidth: '95%', background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        <h2 style={{ marginTop: 0 }}>OAuth Consent Preview</h2>
        <p style={{ color: '#444' }}>This is a preview page for OAuth consent redirects. It shows the request parameters passed to the app.</p>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: '#222' }}><strong>Client ID:</strong> {clientId || <em>not provided</em>}</div>
          <div style={{ fontSize: 13, color: '#222', marginTop: 6 }}><strong>Redirect URI:</strong> {redirect || <em>not provided</em>}</div>
          <div style={{ fontSize: 13, color: '#222', marginTop: 6 }}><strong>Scope:</strong> {scope || <em>none</em>}</div>
          <div style={{ fontSize: 13, color: '#222', marginTop: 6 }}><strong>State:</strong> {state || <em>none</em>}</div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
          <a href={redirect || '/'} style={{ padding: '8px 12px', background: '#1a7f37', color: '#fff', borderRadius: 8, textDecoration: 'none' }}>Approve / Continue</a>
          <a href={process.env.PUBLIC_URL || '/'} style={{ padding: '8px 12px', background: '#eee', color: '#222', borderRadius: 8, textDecoration: 'none' }}>Decline</a>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: '#666' }}>
          Note: this is a client-side preview only. The real consent flow is handled by the OAuth provider and Supabase.
        </div>
      </div>
    </div>
  );
}
