import React from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from './Logo.jsx';

export const POS_STEPS = [
  ['Activate a book', 'Scan a ticket, pick the box'],
  ['Start the shift', 'Last closing numbers load by themselves'],
  ['End the shift', 'Scan the top ticket in each box'],
  ['Get the report', 'Totals are worked out and emailed']
];

export function StepList({ steps }) {
  return (
    <ol className="auth-steps">
      {steps.map(([title, text], i) => (
        <li key={title} className="auth-step">
          <span className="auth-step-num" aria-hidden="true">{i + 1}</span>
          <span>
            <span className="auth-step-title">{title}</span>
            <span className="auth-step-text">{text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function AuthLayout({ heading, aside, children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside" aria-label="About LottoTrack Pro">
        <div className="auth-aside-inner">
          <Link to="/" className="auth-brand" aria-label="LottoTrack Pro home">
            <Wordmark inverse size={34} />
          </Link>
          <h2 className="auth-aside-heading">{heading}</h2>
          {aside}
        </div>
        <svg className="auth-rings" viewBox="0 0 400 400" aria-hidden="true">
          {[60, 110, 160, 210].map(r => <circle key={r} cx="400" cy="400" r={r} />)}
        </svg>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
        <p className="auth-back"><Link to="/">&larr; Back to home</Link></p>
      </main>
    </div>
  );
}

export function PasswordField({ id, label, value, onChange, autoComplete, placeholder, error, hint }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className={`form-group${error ? ' has-error' : ''}`}>
      <label htmlFor={id} className="form-label">{label}</label>
      <div className="input-with-action">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="form-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          required
        />
        <button type="button" className="input-action" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          )}
        </button>
      </div>
      {error ? <span id={`${id}-err`} className="field-error-msg">{error}</span> : hint ? <span id={`${id}-hint`} className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({ id, label, type = 'text', value, onChange, autoComplete, placeholder, error, autoFocus }) {
  return (
    <div className={`form-group${error ? ' has-error' : ''}`}>
      <label htmlFor={id} className="form-label">{label}</label>
      <input
        id={id}
        type={type}
        className="form-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : undefined}
        autoFocus={autoFocus}
        required
      />
      {error && <span id={`${id}-err`} className="field-error-msg">{error}</span>}
    </div>
  );
}
