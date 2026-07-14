import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@supabase/supabase-js';

// Initialize dummy supabase client for UI preview
// Replace with actual keys in production
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key');

export default function AuthPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f1f5f9', direction: 'ltr' }}>
      <div style={{ background: 'white', padding: '3rem', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontFamily: 'inherit', color: '#0f172a' }}>Login to Feasibility Simulator</h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google', 'github']}
        />
        <button onClick={() => window.location.href = '?'} style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>Back to Dashboard</button>
      </div>
    </div>
  );
}
