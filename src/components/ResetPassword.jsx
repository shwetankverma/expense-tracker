import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Shown when the user opens the "reset your password" link from their email.
// Supabase already established a valid recovery session by the time
// App.jsx routes here (see the PASSWORD_RECOVERY auth event) — this screen
// just collects the new password and applies it to that session.
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && password !== confirm;
  const valid = password.length >= 6 && password === confirm;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onDone();
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">₹</div>
        <h1>Set a new password</h1>
        <p>You're almost back in — pick a new password to finish.</p>

        <form onSubmit={submit}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoFocus
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
          />
          <button className="btn" type="submit" disabled={busy || !valid}>
            {busy ? 'Please wait…' : 'Save new password'}
          </button>
        </form>

        {mismatch && <div className="error">Passwords don't match.</div>}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
