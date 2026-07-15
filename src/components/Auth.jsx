import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Email OTP code only. Magic links break installed iOS PWAs (pitfall P2).
export default function Auth() {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sendCode(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setStep('code');
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (err) setError(err.message);
    // on success onAuthStateChange in App.jsx takes over
  }

  return (
    <div className="auth">
      <h1>Expense Tracker</h1>
      {step === 'email' ? (
        <form onSubmit={sendCode}>
          <p>Sign in with your email. You will get a 6-digit code.</p>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <button className="btn" type="submit" disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p>
            Code sent to <strong>{email}</strong>
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
          />
          <button className="btn" type="submit" disabled={busy || code.length !== 6}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <p className="ok">
            <button type="button" onClick={() => { setStep('email'); setCode(''); }}>
              Use a different email
            </button>
          </p>
        </form>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
