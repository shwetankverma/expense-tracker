import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) setError(err.message);
      // on success onAuthStateChange in App.jsx takes over
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(err.message);
      } else if (data.session === null) {
        // email confirmation is turned on in Supabase
        setInfo('Account created. Check your email to confirm, then log in.');
        setMode('login');
      }
      // if confirmation is off, a session arrives and the app loads
    }
    setBusy(false);
  }

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setInfo('');
  };

  async function googleLogin() {
    setError('');
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (err) setError(err.message);
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">₹</div>
        <h1>Expense Tracker</h1>
        <p>Your money, quietly organised.</p>

        <div className="seg auth-seg">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">
            Log in
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">
            Register
          </button>
        </div>

        <form onSubmit={submit}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? 'Password' : 'Password (min 6 characters)'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button className="btn" type="submit" disabled={busy || !email.trim() || password.length < 6}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="divider"><span>or</span></div>

        <button className="btn google" type="button" onClick={googleLogin}>
          <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {error && <div className="error">{error}</div>}
        {info && <div className="ok">{info}</div>}
      </div>
    </div>
  );
}
