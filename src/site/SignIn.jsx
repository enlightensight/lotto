import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthLayout, { POS_STEPS, StepList, PasswordField, TextField } from './AuthLayout.jsx';
import { enterPos, postJson } from './session.js';

function ForgotPassword({ initialEmail }) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState({ busy: false, message: '', error: '' });

  async function onSubmit(e) {
    e.preventDefault();
    setStatus({ busy: true, message: '', error: '' });
    try {
      const { ok, data } = await postJson('/api/auth/forgot-password', { email: email.trim() });
      setStatus(ok ? { busy: false, message: data.message, error: '' } : { busy: false, message: '', error: data.message || 'Something went wrong.' });
    } catch (_) {
      setStatus({ busy: false, message: '', error: 'Could not reach the server. Try again.' });
    }
  }

  return (
    <form className="auth-form forgot-form" onSubmit={onSubmit} noValidate>
      <p className="auth-help">Enter your account email and we'll send you a link to choose a new password.</p>
      {status.message && <div className="form-feedback-box is-success" role="status">{status.message}</div>}
      {status.error && <div className="form-feedback-box is-error" role="alert">{status.error}</div>}
      <TextField id="forgot-email" label="Account email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="owner@store.com" />
      <button type="submit" className="btn btn-secondary btn-block" disabled={status.busy}>
        {status.busy ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}

export default function SignIn() {
  const location = useLocation();
  const notice = location.state?.notice || '';
  const [identifier, setIdentifier] = useState(location.state?.email || localStorage.getItem('lotto_remembered_user') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Enter your email or username and your password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = identifier.trim();
      const { ok, data } = await postJson('/api/auth/login', { identifier: id, email: id, username: id, password });
      if (!ok) {
        setError(data.message || 'Incorrect email or password.');
        setBusy(false);
        return;
      }
      enterPos(data, id);
    } catch (_) {
      setError('Could not reach the server. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      heading="Scratch-off books, boxes and shift reports, in four simple steps."
      aside={<StepList steps={POS_STEPS} />}
    >
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-sub">Sign in to LottoTrack Pro</p>

      {notice && <div className="form-feedback-box is-success" role="status">{notice}</div>}
      {error && <div className="form-feedback-box is-error" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <TextField
          id="signin-identifier"
          label="Email or username"
          value={identifier}
          onChange={setIdentifier}
          autoComplete="username"
          placeholder="name@example.com or username"
          autoFocus={!identifier}
        />
        <PasswordField
          id="signin-password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Enter password"
        />
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <button type="button" className="auth-link-btn" onClick={() => setShowReset(s => !s)} aria-expanded={showReset}>
        Forgot password?
      </button>
      {showReset && <ForgotPassword initialEmail={identifier.includes('@') ? identifier.trim() : ''} />}

      <div className="auth-divider"><span>New to LottoTrack Pro?</span></div>
      <Link to="/signup" className="btn btn-secondary btn-block">Get a license, $179 one time</Link>
    </AuthLayout>
  );
}
