import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { PasswordField, TextField } from './AuthLayout.jsx';
import { enterPos, postJson } from './session.js';

const PRICE = 179;
const INCLUDED = [
  'Lifetime license for your store',
  'Up to 250 dispenser boxes',
  'Shift and day reports, print and email',
  'Cash reconciliation and pack inventory',
  'All future updates'
];

function OrderSummary() {
  return (
    <div className="order-summary">
      <div className="order-row order-row-head">
        <span>LottoTrack Pro, lifetime license</span>
        <span>${PRICE}.00</span>
      </div>
      <ul className="order-included">
        {INCLUDED.map(i => <li key={i}>{i}</li>)}
      </ul>
      <div className="order-row order-total">
        <span>Total due today</span>
        <span>${PRICE}.00</span>
      </div>
      <p className="order-note">One-time payment. No subscription, no renewal.</p>
    </div>
  );
}

function Steps({ step }) {
  const items = ['Account', 'Payment', 'Ready'];
  return (
    <ol className="signup-steps" aria-label="Sign up progress">
      {items.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'is-done' : n === step ? 'is-current' : '';
        return (
          <li key={label} className={state} aria-current={n === step ? 'step' : undefined}>
            <span className="signup-step-dot">{n < step ? '✓' : n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export default function SignUp() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const returnRef = params.get('checkout_id') || params.get('checkout_session_id'); // Polar / Stripe return
  const [gateway, setGateway] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ storeName: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [result, setResult] = useState(null);
  const completing = useRef(false);

  const set = key => value => {
    setForm(f => ({ ...f, [key]: value }));
    setFieldErrors(fe => ({ ...fe, [key]: '' }));
  };

  useEffect(() => {
    fetch('/api/purchase/config').then(r => r.json()).then(d => setGateway(d.gateway || 'none')).catch(() => setGateway('none'));
  }, []);

  async function complete(ref) {
    if (completing.current) return;
    completing.current = true;
    setBusy(true);
    setError('');
    try {
      const { ok, data } = await postJson('/api/purchase/complete', { paymentRef: ref });
      if (!ok) {
        setError(data.message || 'We could not activate your license.');
        completing.current = false;
        setBusy(false);
        return;
      }
      if (data.alreadyActivated) {
        navigate('/signin', { replace: true, state: { notice: data.message } });
        return;
      }
      setResult(data);
      setStep(3);
    } catch (_) {
      setError('Could not reach the server. Your payment is safe; refresh this page to finish activation.');
      completing.current = false;
    }
    setBusy(false);
  }

  // Returning from Stripe Checkout
  useEffect(() => {
    const sessionId = returnRef;
    if (sessionId) {
      setStep(2);
      setPaymentRef(sessionId);
      complete(sessionId);
    } else if (params.get('checkout_cancelled')) {
      setNotice('Payment was cancelled, so no account was created. You can try again below.');
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    const fe = {};
    if (form.storeName.trim().length < 2) fe.storeName = 'Enter your store name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fe.email = 'Enter a valid email address.';
    if (form.password.length < 8) fe.password = 'Use at least 8 characters.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  async function onAccountSubmit(e) {
    e.preventDefault();
    setNotice('');
    if (!validate()) return;
    setBusy(true);
    setError('');
    try {
      const { ok, data } = await postJson('/api/purchase/start', {
        storeName: form.storeName.trim(),
        email: form.email.trim(),
        password: form.password
      });
      if (!ok) {
        if (data.field) setFieldErrors({ [data.field]: data.message });
        else setError(data.message || 'Could not start checkout.');
        setBusy(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl); // Polar/Stripe hosted card page; returns to /signup?checkout_id=… (or checkout_session_id)
        return;
      }
      setPaymentRef(data.paymentRef);
      setStep(2);
    } catch (_) {
      setError('Could not reach the server. Check your connection and try again.');
    }
    setBusy(false);
  }

  async function onTestPay(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { ok, data } = await postJson('/api/purchase/test-confirm', { paymentRef }).catch(() => ({ ok: false, data: {} }));
    if (!ok) {
      setError(data.message || 'Payment failed.');
      setBusy(false);
      return;
    }
    complete(paymentRef);
  }

  const aside = (
    <>
      <p className="auth-aside-text">One payment sets up your store. Your license key is generated for your account automatically, and you go straight into the software.</p>
      <div className="auth-aside-price">
        <span className="auth-aside-amount">${PRICE}</span>
        <span className="auth-aside-term">one time, lifetime license</span>
      </div>
      <ul className="auth-checklist">
        {INCLUDED.map(i => <li key={i}>{i}</li>)}
      </ul>
    </>
  );

  return (
    <AuthLayout heading="Run your lottery counter on LottoTrack Pro." aside={aside}>
      <Steps step={step} />

      {step === 1 && (
        <>
          <h1 className="auth-title">Create your store account</h1>
          <p className="auth-sub">Three details, then payment. You'll use this email and password to sign in.</p>
          {notice && <div className="form-feedback-box is-info" role="status">{notice}</div>}
          {error && <div className="form-feedback-box is-error" role="alert">{error}</div>}
          <form className="auth-form" onSubmit={onAccountSubmit} noValidate>
            <TextField id="su-store" label="Store name" value={form.storeName} onChange={set('storeName')} autoComplete="organization" placeholder="e.g. Quick Stop Food Mart" error={fieldErrors.storeName} autoFocus />
            <TextField id="su-email" label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="owner@store.com" error={fieldErrors.email} />
            <PasswordField id="su-password" label="Password" value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="At least 8 characters" error={fieldErrors.password} hint="At least 8 characters." />
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || gateway === null}>
              {busy ? 'Please wait…' : `Continue to payment, $${PRICE}`}
            </button>
            {(gateway === 'polar' || gateway === 'stripe') && <p className="auth-fine">You'll pay on {gateway === 'polar' ? 'Polar' : 'Stripe'}'s secure checkout page, then come straight back here.</p>}
            {gateway === 'none' && <p className="auth-fine is-warning">Payments aren't set up on this server yet, so checkout can't start.</p>}
          </form>
          <p className="auth-switch">Already have an account? <Link to="/signin">Sign in</Link></p>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="auth-title">{returnRef ? 'Activating your license' : 'Payment'}</h1>
          <p className="auth-sub">
            {returnRef
              ? 'Confirming your payment and setting up your store…'
              : <>Account for <strong>{form.storeName}</strong> ({form.email})</>}
          </p>
          {error && <div className="form-feedback-box is-error" role="alert">{error}</div>}
          <OrderSummary />
          {!returnRef && (
            <form className="auth-form" onSubmit={onTestPay}>
              <div className="test-mode-banner" role="note">
                <strong>Test mode.</strong> No card is charged. Set <code>STRIPE_SECRET_KEY</code> on the server to take real payments.
              </div>
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
                {busy ? 'Processing…' : `Pay $${PRICE}.00`}
              </button>
              <button type="button" className="auth-link-btn" onClick={() => { setStep(1); setError(''); }} disabled={busy}>
                &larr; Edit account details
              </button>
            </form>
          )}
          {returnRef && error && (
            <button type="button" className="btn btn-secondary btn-block" onClick={() => complete(paymentRef)} disabled={busy}>Try again</button>
          )}
        </>
      )}

      {step === 3 && result && (
        <div className="signup-done">
          <h1 className="auth-title">You're all set</h1>
          <p className="auth-sub">Payment received. <strong>{result.storeName}</strong> is licensed to use LottoTrack Pro.</p>
          <div className="license-box">
            <span className="license-label">Your license key</span>
            <code className="license-key">{result.licenseKey}</code>
            <span className="license-meta">Linked to {result.user?.email}. Keep it for your records.</span>
          </div>
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => enterPos(result, result.user?.email)}>
            Open LottoTrack Pro
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
