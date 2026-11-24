import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from './Logo.jsx';

const IMG = '/landing';

const WORKFLOW = [
  ['1. A pack arrives at your store.', 'Scan or type the barcode on any incoming scratch-off roll. LottoTrack automatically identifies the game title, ticket price ($1 to $50), and pack size without manual typing.', '01-scan-pack.png', 'LottoTrack Update Inventory and Store Audit showing active packs, empty slots, and ticket counts across dispenser boxes'],
  ['2. Put it in an active box.', 'Assign the pack to any counter box (Box 1 to Box 65). The on-screen grid mirrors your physical acrylic counter rack box-for-box so cashiers always know what is in each slot.', '03-choose-box.png', 'Dispenser box details showing a pack with ticket counts and management actions'],
  ['3. Sell tickets with 1 scan or click.', 'As customers buy tickets, cashiers scan the barcode or tap +1 on the box. Real-time audio and voice feedback confirms every sale so no ticket is missed.', '04-sell-ticket.png', 'Cashier selling a ticket with large controls and instant position tracking'],
  ['4. Live inventory updates automatically.', 'The live inventory dashboard displays active pack counts, tickets remaining in the rack, tickets sold today, and total retail dollar value on display.', '05-inventory-updates.png', 'Lottery inventory status dashboard showing active packs, tickets sold, remaining tickets and rack value'],
  ['5. Safe storage & vendor returns.', 'Keep counter inventory and back safe storage in perfect sync. If a game ends or needs to be returned to the state lottery for credit, remove it safely with 1 click.', '06-close-shift.png', 'Pack removal options showing Return to Lottery and Move to Storage'],
  ['6. Close the shift in under 3 minutes.', 'At shift change or store closing, cashiers quickly scan or enter closing tickets. LottoTrack does all the math automatically—no paper logs or midnight calculators.', '02-pack-identified.png', 'Two-phase end shift reconciliation calculating ticket counts and sales totals'],
  ['7. The report is ready & emailed to you.', 'LottoTrack generates an itemized Day Report showing starting/closing ticket numbers and revenue per box. It prints cleanly, exports to PDF, and auto-emails to the owner.', '07-report.png', 'Day Report print preview showing itemized box numbers, open and close ticket counts and total sales']
];

const FAQ = [
  ['I have zero lottery experience. Is LottoTrack easy to learn?', 'Yes, absolutely! If you can scan a grocery barcode, you can use LottoTrack. We designed it for busy store clerks with large buttons, high-contrast text, spoken voice prompts, and zero confusing jargon.'],
  ['What is a "pack" and a "dispenser box"?', 'In retail stores, scratch-off lottery tickets come from the state lottery in connected rolls called "packs" (or books), with numbered tickets (e.g. #000 to #029). These rolls sit on your checkout counter in clear acrylic containers called "dispenser boxes" (Box 1 to Box 65). LottoTrack displays a visual on-screen copy of your counter rack.'],
  ['Do I need to buy expensive equipment or computers?', 'No expensive hardware required! LottoTrack Pro runs in any web browser (Chrome, Edge, Safari) on your existing computer, tablet, iPad, laptop, or POS touch screen. It also installs with 1 click as a desktop app and works offline.'],
  ['Does it work with standard barcode scanners?', 'Yes! Any standard USB or wireless Bluetooth barcode scanner that plugs into your computer or tablet works out-of-the-box. Just scan the ticket barcode, and LottoTrack reads it instantly.'],
  ['Which lottery states and ticket formats are supported?', 'LottoTrack provides 100% accurate native barcode parsing for Georgia Lottery (GA), South Carolina Education Lottery (SCEL), and all standard US lottery scratch-off formats ($1, $2, $3, $5, $10, $20, $25, $30, $50 games with 14-digit, 17-digit, and delimited barcodes).'],
  ['How does cash drawer reconciliation work?', 'LottoTrack calculates: [Starting Bank Float] + [Scratch-Off Ticket Sales] + [Online Lottery Sales] - [Player Payouts] = Expected Cash. When your cashier counts the money in the drawer, the system immediately tells you if it is Balanced, Over, or Short.'],
  ['Can I receive daily sales reports when I am away from the store?', 'Yes! Enter your email address in Settings. Every time a cashier closes a shift or day, an itemized sales and reconciliation report is automatically sent directly to your phone or inbox.'],
  ['Can multiple cashiers use it and can I manage multiple stores?', 'Yes. Cashiers can switch shifts in seconds with individual names and PINs. Store owners can also manage multiple store locations from a single dashboard.'],
  ['What if a cashier enters the wrong ticket number?', 'No problem! Use "Fix Position" to correct any ticket number in seconds. You never have to restart a shift or recount your whole store because of one typo.']
];

const PRICE_FEATURES = [
  'Up to 65+ modular dispenser boxes',
  'Fast barcode scanning (Georgia, South Carolina & Universal)',
  'Cash drawer reconciliation (Balanced, Over, or Short)',
  'Itemized Shift & Day Reports (Print, Export & PDF)',
  'Automatic daily report emails to store owners',
  'Safe inventory, storage reserves & vendor returns',
  'Works in any browser, tablet, or touch POS screen',
  'Role-based cashier & store manager logins'
];

function Shot({ file, alt, eager }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`screenshot-frame${failed ? ' has-failed' : ''}`}>
      <img src={`${IMG}/screenshots/${file}`} alt={alt} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
      <div className="frame-fallback" aria-hidden="true">
        <span className="frame-fallback-label">Screenshot unavailable</span>
        <span className="frame-fallback-specs">{file}</span>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="site-header" role="banner">
      <div className="container nav-container">
        <Link to="/" className="brand-logo" aria-label="LottoTrack Pro home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary navigation">
          <ul className={`nav-links${open ? ' is-open' : ''}`}>
            <li><a href="/#how" className="nav-link" onClick={close}>How It Works</a></li>
            <li><a href="/#benefits" className="nav-link" onClick={close}>Benefits</a></li>
            <li><a href="/#pricing" className="nav-link" onClick={close}>Pricing</a></li>
            <li><a href="/#faq" className="nav-link" onClick={close}>FAQ</a></li>
          </ul>
        </nav>
        <div className="nav-actions">
          <Link to="/signin" className="btn btn-secondary">Sign in</Link>
          <Link to="/signup" className="btn btn-primary nav-cta">Get started</Link>
          <button type="button" className="mobile-nav-toggle" aria-expanded={open} aria-label="Toggle navigation menu" onClick={() => setOpen(o => !o)}>
            Menu
          </button>
        </div>
      </div>
    </header>
  );
}

function Faq() {
  const [openIdx, setOpenIdx] = useState(-1);
  return (
    <div className="faq-list">
      {FAQ.map(([q, a], i) => (
        <details key={q} className="faq-item" open={openIdx === i}>
          <summary className="faq-summary" onClick={e => { e.preventDefault(); setOpenIdx(openIdx === i ? -1 : i); }}>{q}</summary>
          <div className="faq-answer"><p>{a}</p></div>
        </details>
      ))}
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <SiteHeader />

      <main id="main-content">
        {/* 1. Hero */}
        <section className="hero-section" aria-labelledby="hero-heading">
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <span className="eyebrow">Smart Retail Lottery POS &amp; Inventory System</span>
                <h1 id="hero-heading" className="hero-h1">Stop <span className="hero-highlight">handwriting</span> lottery logs. Start tracking in seconds.</h1>
                <p className="hero-text">
                  LottoTrack Pro is the all-in-one digital lottery register for convenience stores and gas stations. Track every scratch-off ticket, audit your counter rack in real time, and balance your cash drawer at shift close without pencil math, missing tickets, or cash shortages.
                </p>
                <div className="hero-cta-group">
                  <Link to="/signup" className="btn btn-primary">Get LottoTrack Pro, $179</Link>
                  <Link to="/signin" className="btn btn-secondary">Sign in</Link>
                </div>
                <div className="hero-small-line">
                  <span>One-time lifetime payment. Zero monthly fees. Works on any computer, tablet, iPad, or touch POS.</span>
                </div>
              </div>
              <div className="hero-rack-clean">
                <div className="hero-visual-pair">
                  <figure>
                    <img src={`${IMG}/dispenser-rack.jpg`} alt="Physical acrylic scratch-off dispenser rack on store checkout counter" className="hero-rack-img hero-visual-photo" loading="eager" />
                    <figcaption className="rack-caption">Physical counter rack (acrylic dispenser boxes)</figcaption>
                  </figure>
                  <figure>
                    <img src={`${IMG}/screenshots/cashier-screen.png`} alt="LottoTrack Pro digital counter screen showing active dispenser boxes with prices, tickets remaining and live settlement" className="hero-rack-img hero-visual-screen" loading="eager" />
                    <figcaption className="rack-caption">LottoTrack Pro on your screen (mirrors your rack)</figcaption>
                  </figure>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1b. Beginner Explainer: For visitors with zero lottery knowledge */}
        <section className="section" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }} aria-labelledby="beginner-heading">
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto 2.5rem' }}>
              <span className="eyebrow">New to Retail Lottery?</span>
              <h2 id="beginner-heading" className="section-h2">Here is how scratch-off lottery works in stores &mdash; and why LottoTrack is essential.</h2>
              <p className="section-lead">If you have never run a lottery register before, the paperwork can be overwhelming. Here is how it works in 3 simple steps:</p>
            </div>
            <div className="how-steps-grid">
              <div className="how-step-card" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                <span className="how-step-badge" style={{ background: '#1d4ed8', color: '#fff' }}>1</span>
                <h3 className="how-step-title">The Counter Rack (Boxes)</h3>
                <p className="how-step-desc">Stores keep scratch-off tickets in clear acrylic boxes on the checkout counter (Box 1 to Box 65). Each numbered box holds a different game ($1, $2, $5, $10, $20, up to $50 tickets).</p>
              </div>
              <div className="how-step-card" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                <span className="how-step-badge" style={{ background: '#1d4ed8', color: '#fff' }}>2</span>
                <h3 className="how-step-title">The Ticket Rolls (Packs)</h3>
                <p className="how-step-desc">Tickets arrive in connected rolls called &quot;packs&quot; with numbers printed on them (like #000 to #029). When a customer buys a ticket, the cashier tears it off the roll.</p>
              </div>
              <div className="how-step-card" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                <span className="how-step-badge" style={{ background: '#1d4ed8', color: '#fff' }}>3</span>
                <h3 className="how-step-title">The Closing Math &amp; Cash</h3>
                <p className="how-step-desc">At shift end, stores must calculate: <em>How many tickets were sold? How much cash should be in the drawer?</em> Doing this with paper notebooks leads to math errors and cash shortages. LottoTrack automates all of it.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Problem */}
        <section className="section section-problem-open" aria-labelledby="problem-heading">
          <div className="container">
            <div className="problem-layout-open">
              <div className="problem-header">
                <span className="eyebrow">The Cost of Paper Logs</span>
                <h2 id="problem-heading" className="section-h2">Handwritten lottery notebooks cost stores thousands in errors and shortages.</h2>
                <p className="section-lead">At the end of a busy shift, cashiers shouldn&apos;t be forced to do midnight calculator math across 65 different boxes.</p>
              </div>
              <div className="problem-points-col">
                <ul className="problem-points-list">
                  {[
                    'Writing down 65 ticket numbers by hand takes 45+ minutes every shift.',
                    'One misread number throws off your entire shift sales calculation.',
                    "When the cash drawer is short, you cannot tell whether money was stolen or miscounted.",
                    'Stored reserve packs in the safe are forgotten or lost without real-time inventory tracking.'
                  ].map((t, i) => (
                    <li key={i} className="problem-point-item">
                      <span className="problem-marker" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                      <span className="problem-point-text">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="showcase-block">
              <div className="showcase-head">
                <span className="eyebrow">Live system screenshot</span>
                <h3 className="showcase-title">Real-time dispenser stock and audit dashboard</h3>
                <p className="showcase-text">LottoTrack replaces handwritten paperwork with instant visibility into every box, pack and ticket.</p>
              </div>
              <Shot file="rack.png" alt="Lottery inventory status dashboard showing active packs, tickets in rack, tickets sold today and total rack value" />
            </div>
          </div>
        </section>

        {/* 3. How it works */}
        <section id="how" className="section" aria-labelledby="how-heading">
          <div className="container">
            <h2 id="how-heading" className="section-h2">Three simple steps. No lottery math required.</h2>
            <div className="how-steps-grid">
              {[
                ['1. Scan the barcode.', 'Scan incoming packs or sold tickets with any USB or Bluetooth barcode scanner. The game, price, and pack number are detected automatically.'],
                ['2. LottoTrack tracks live.', 'Ticket positions, remaining inventory, tickets sold, and sales dollars update in real time across your 65+ box rack.'],
                ['3. Reconcile in 3 minutes.', 'At shift close, scan or enter closing tickets. LottoTrack checks your cash drawer (Balanced / Over / Short) and emails the Day Report to the owner.']
              ].map(([title, desc], i) => (
                <div key={title} className="how-step-card">
                  <span className="how-step-badge">{i + 1}</span>
                  <h3 className="how-step-title">{title}</h3>
                  <p className="how-step-desc">{desc}</p>
                </div>
              ))}
            </div>
            <p className="closing-statement">You scan. LottoTrack calculates the math, audits the rack, and protects your cash.</p>
          </div>
        </section>

        {/* 4. Workflow */}
        <section className="section" aria-labelledby="workflow-heading">
          <div className="container">
            <h2 id="workflow-heading" className="section-h2">One record from pack to sale.</h2>
            <p className="section-lead">LottoTrack Pro follows each pack from delivery to the finished shift report. The steps below show where the record is made.</p>
            <div className="workflow-stack">
              {WORKFLOW.map(([title, text, file, alt], i) => (
                <article key={file} className="workflow-step-row">
                  <div className="workflow-step-meta">
                    <span className="workflow-step-index">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="workflow-step-title">{title}</h3>
                    <p className="workflow-step-sentence">{text}</p>
                  </div>
                  <div className="workflow-step-visual"><Shot file={file} alt={alt} /></div>
                </article>
              ))}
            </div>
            <p className="closing-statement">The work happens at the counter. The record stays connected.</p>
          </div>
        </section>

        {/* 5. Benefits */}
        <section id="benefits" className="section" aria-labelledby="benefits-heading">
          <div className="container">
            <h2 id="benefits-heading" className="section-h2">Less paperwork for you. Complete clarity for your staff.</h2>
            
            <div className="perspectives-grid">
              <div className="perspective-block">
                <h3 className="perspective-role-title">For Store Owners:</h3>
                <ul className="perspective-features-list">
                  <li><strong>Stop cash loss &amp; theft:</strong> Automatically compare counted cash against actual ticket sales and player payouts to see if the drawer is Balanced, Over, or Short.</li>
                  <li><strong>Save 45+ minutes every day:</strong> Eliminate tedious notebook logging and midnight calculator math across all 65 dispenser boxes.</li>
                  <li><strong>Daily reports sent to your email:</strong> Shift and Day Reports are auto-emailed to your phone the moment a shift closes so you stay informed anywhere.</li>
                  <li><strong>Safe &amp; counter inventory control:</strong> Monitor active packs on the counter, spare rolls in the safe, and vendor return credits from one screen.</li>
                </ul>
                <div className="perspective-visuals-stack"><Shot file="rack.png" alt="Lottery inventory status dashboard" /></div>
              </div>
              <div className="perspective-block">
                <h3 className="perspective-role-title">For Cashiers &amp; Counter Staff:</h3>
                <ul className="perspective-features-list">
                  <li><strong>Large, touch-friendly controls:</strong> Designed for fast-paced retail checkout counters with clear numbers and responsive touch keys.</li>
                  <li><strong>Audio &amp; voice confirmations:</strong> Audible beeps and spoken ticket confirmations prevent missed scans and accidental double-scans.</li>
                  <li><strong>Stress-free 3-minute shift handoff:</strong> Hand over the register to the next clerk in minutes with automated sales calculations.</li>
                  <li><strong>Instant error correction:</strong> Entered the wrong number? Use &quot;Fix Position&quot; to correct any ticket in 2 seconds without restarting.</li>
                </ul>
                <div className="perspective-visuals-stack"><Shot file="cashier-screen.png" alt="LottoTrack Pro counter screen with large +1 sell buttons and live totals" /></div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Reconciliation */}
        <section className="section" aria-labelledby="reconciliation-heading">
          <div className="container">
            <h2 id="reconciliation-heading" className="section-h2">Know exactly what your cash drawer should contain.</h2>
            <p className="section-lead">LottoTrack combines starting cash float, scratch-off ticket sales, online lottery terminal sales, and player winning payouts to calculate expected cash down to the exact penny.</p>
            <div className="reconciliation-panel">
              <div className="reconciliation-flow-bar" role="region" aria-label="Reconciliation formula example">
                {[
                  ['Ticket sales', '+ $412', 'positive'], ['Payouts', '- $96', 'negative'], ['Bank float', '+ $150', 'positive'],
                  ['Expected cash', '$466', 'expected'], ['Counted cash', '$466', ''], ['Status', 'Balanced', 'positive']
                ].map(([label, value, cls]) => (
                  <div key={label} className="reconciliation-math-item">
                    <span className="math-label">{label}</span>
                    <span className={`math-value ${cls}`}>{value}</span>
                  </div>
                ))}
              </div>
              <p className="reconciliation-outcomes-header">If counted cash differs from expected cash, you instantly see whether you are Over or Short.</p>
              <div className="reconciliation-outcomes-grid">
                <div className="outcome-card is-balanced"><div className="outcome-status">Balanced</div><div className="outcome-detail">($466 counted against expected $466) &mdash; Perfect match</div></div>
                <div className="outcome-card is-over"><div className="outcome-status">Over</div><div className="outcome-detail">($480 counted against expected $466) &mdash; Extra cash in drawer</div></div>
                <div className="outcome-card is-short"><div className="outcome-status">Short</div><div className="outcome-detail">($450 counted against expected $466) &mdash; Cash or ticket discrepancy</div></div>
              </div>
              <span className="illustration-notice">Example figures shown for illustration.</span>
            </div>
          </div>
        </section>

        {/* 7. Fix mistakes */}
        <section className="section" aria-labelledby="mistakes-heading">
          <div className="container">
            <h2 id="mistakes-heading" className="section-h2">Made a mistake? Fix it in seconds.</h2>
            <div className="fix-mistakes-panel">
              <div className="workflow-correction-strip" role="region" aria-label="Example workflow demonstrating position correction">
                <span className="correction-badge-wrong">ticket entered 0187</span>
                <span className="correction-arrow" aria-hidden="true">&gt;</span>
                <span className="correction-badge-action">Fix Position</span>
                <span className="correction-arrow" aria-hidden="true">&gt;</span>
                <span className="correction-badge-fixed">correct position 0186</span>
              </div>
              <ul className="fix-mistakes-list">
                <li><strong>Wrong ticket number?</strong> Tap &quot;Fix Position&quot; to adjust the current ticket number.</li>
                <li><strong>Wrong box?</strong> Move a game between boxes or update the box number instantly.</li>
                <li><strong>Pack finished?</strong> Mark it sold out and load the next roll in 1 tap.</li>
                <li><strong>Removing a pack from the counter?</strong> Return it to the lottery vendor for credit or move it to the safe for later.</li>
              </ul>
              <span className="illustration-notice">Simple 1-click corrections &mdash; you never have to restart a shift.</span>
            </div>
            <p className="closing-statement">Human errors happen at busy counters. LottoTrack makes fixing them effortless.</p>
          </div>
        </section>

        {/* 8. Pricing */}
        <section id="pricing" className="section" aria-labelledby="pricing-heading">
          <div className="container">
            <div className="pricing-wrapper">
              <div className="pricing-pitch">
                <span className="eyebrow">Lifetime Value</span>
                <h2 id="pricing-heading" className="section-h2">One simple price. Yours forever.</h2>
                <p className="section-lead">
                  Pay once and LottoTrack Pro is fully licensed to your store. No recurring monthly subscriptions, no per-ticket fees, and no surprise charges.
                </p>
                <ul className="compact-feature-list">
                  <li className="compact-feature-item"><strong>65+ Box Rack:</strong> Live on-screen counter display matching your store&apos;s physical rack.</li>
                  <li className="compact-feature-item"><strong>Automated Reports:</strong> Itemized shift reports, day reports, and automatic email delivery to owners.</li>
                  <li className="compact-feature-item"><strong>Cash Reconciliation:</strong> Real-time tracking of ticket sales, terminal payouts, and cash balance.</li>
                </ul>
              </div>
              <div className="price-card">
                <div className="price-card-head">
                  <span className="price-card-name">LottoTrack Pro</span>
                  <span className="price-card-tag">Lifetime license</span>
                </div>
                <div className="price-amount">
                  <span className="price-currency">$</span>179
                  <span className="price-term">one time</span>
                </div>
                <ul className="price-features">
                  {PRICE_FEATURES.map(f => <li key={f}>{f}</li>)}
                </ul>
                <Link to="/signup" className="btn btn-primary btn-block">Get started</Link>
                <p className="price-footnote">Already purchased? <Link to="/signin">Sign in</Link></p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. FAQ */}
        <section id="faq" className="section" aria-labelledby="faq-heading">
          <div className="container">
            <h2 id="faq-heading" className="section-h2">Frequently Asked Questions</h2>
            <Faq />
          </div>
        </section>
      </main>

      <footer className="site-footer" role="contentinfo">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <Wordmark size={26} inverse />
              <div className="footer-brand-desc">Retail lottery POS and shift tracking.</div>
            </div>
            <ul className="footer-links">
              <li><a href="/#how" className="footer-link">How It Works</a></li>
              <li><a href="/#pricing" className="footer-link">Pricing</a></li>
              <li><a href="/#faq" className="footer-link">FAQ</a></li>
              <li><Link to="/signin" className="footer-link">Sign in</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </>
  );
}
