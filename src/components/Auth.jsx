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

        {error && <div className="error">{error}</div>}
        {info && <div className="ok">{info}</div>}
      </div>
    </div>
  );
}
