import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { POS_STEPS, StepList, PasswordField } from './AuthLayout.jsx';
import { postJson } from './session.js';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const fe = {};
    if (password.length < 8) fe.password = 'Use at least 8 characters.';
    if (confirm !== password) fe.confirm = "Passwords don't match.";
    setErrors(fe);
    if (Object.keys(fe).length) return;

    setBusy(true);
    setError('');
    try {
      const { ok, data } = await postJson('/api/auth/reset-password', { token, password });
      if (!ok) {
        setError(data.message || 'Could not reset your password.');
        setBusy(false);
        return;
      }
      navigate('/signin', { replace: true, state: { notice: data.message, email: data.email } });
    } catch (_) {
      setError('Could not reach the server. Try again.');
      setBusy(false);
    }
  }

  return (
    <AuthLayout heading="Scratch-off books, boxes and shift reports, in four simple steps." aside={<StepList steps={POS_STEPS} />}>
      <h1 className="auth-title">Choose a new password</h1>
      {!token ? (
        <>
          <div className="form-feedback-box is-error" role="alert">This reset link is incomplete. Open the link from your email again, or request a new one.</div>
          <Link to="/signin" className="btn btn-secondary btn-block">Back to sign in</Link>
        </>
      ) : (
        <>
          <p className="auth-sub">After this, sign in with your new password on every device.</p>
          {error && <div className="form-feedback-box is-error" role="alert">{error}</div>}
          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" error={errors.password} hint="At least 8 characters." />
            <PasswordField id="reset-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Type it again" error={errors.confirm} />
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
          <p className="auth-switch"><Link to="/signin">Back to sign in</Link></p>
        </>
      )}
    </AuthLayout>
  );
}
