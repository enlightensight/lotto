import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from './Logo.jsx';

const IMG = '/landing';

const WORKFLOW = [
  ['A pack arrives.', 'Scan or type the incoming pack barcode into Fast Pack Intake. LottoTrack identifies the game and activates the pack directly into your dispenser inventory.', '01-scan-pack.png', 'LottoTrack Update Inventory and Store Audit showing active packs, empty slots, and ticket counts across dispenser boxes'],
  ['LottoTrack audits your stock.', 'The store audit keeps complete count of active packs, empty slots, and reserve packs stored off-counter in your safe, keeping counter and safe inventory in sync.', '02-pack-identified.png', 'Update Inventory and Store Audit showing active packs, empty slots, and off-counter safe storage inventory'],
  ['Put it in a box.', 'Box details show the active game, pack number, starting ticket #00, tickets sold, and remaining count, with quick actions to switch boxes or adjust ticket positions.', '03-choose-box.png', 'Dispenser box details showing a pack with ticket counts and management actions'],
  ['Inventory updates.', 'The real-time inventory dashboard displays active pack counts, shift sales, remaining tickets, and total retail value on display.', '05-inventory-updates.png', 'Lottery inventory status dashboard showing active packs, tickets sold, remaining tickets and rack value'],
  ['The shift closes.', 'During shift closing or game changes, choose whether to return unsold tickets to the lottery for vendor credit or safely transfer them into your store safe.', '06-close-shift.png', 'Pack removal options showing Return to Lottery and Move to Storage'],
  ['The report is ready.', 'LottoTrack compiles the Day Report showing itemized opening and closing ticket numbers, prices, and total sales per box, ready to print or save to PDF.', '07-report.png', 'Day Report print preview showing itemized box numbers, open and close ticket counts and total sales']
];

const FAQ = [
  ['Do I need to install anything?', 'No installation is required. LottoTrack Pro runs in your web browser. You can also install it as a standalone app on your computer or tablet for a full-screen experience.'],
  ['How much does it cost?', 'One payment of $179. That buys a lifetime license for your store: no monthly fee and no renewal.'],
  ['How soon can I start?', 'Right away. Your license is created the moment your payment goes through, and you are signed straight into the software.'],
  ['How do I sell a ticket?', 'Scan the ticket barcode, or press +1 on that box.'],
  ['What if I enter the wrong ticket number?', 'Open the box and use Fix Position to correct it.'],
  ['Can more than one person use it?', 'Yes. You can switch the active cashier, and each shift report records who worked that shift.'],
  ['Will it work with my state\'s lottery?', 'The current day report follows the Georgia Lottery layout. Contact us to ask about your state.']
];

const PRICE_FEATURES = [
  'Up to 250 dispenser boxes',
  'Shift and day reports, print, export and email',
  'Cash reconciliation: balanced, over or short',
  'Pack inventory, storage and returns',
  'Works in any browser, installs as an app',
  'All future updates included'
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
                <span className="eyebrow">Retail lottery POS and shift tracking</span>
                <h1 id="hero-heading" className="hero-h1">Stop <span className="hero-highlight">handwriting</span> your lottery logs.</h1>
                <p className="hero-text">
                  LottoTrack Pro tracks every scratch-off pack, keeps your inventory and sales up to date, and helps balance your cash drawer at the end of the shift.
                </p>
                <div className="hero-cta-group">
                  <Link to="/signup" className="btn btn-primary">Get LottoTrack Pro, $179</Link>
                  <Link to="/signin" className="btn btn-secondary">Sign in</Link>
                </div>
                <div className="hero-small-line">
                  <span>One-time payment. Works in any browser and installs as an app on your device.</span>
                </div>
              </div>
              <div className="hero-rack-clean">
                <div className="hero-visual-pair">
                  <figure>
                    <img src={`${IMG}/dispenser-rack.jpg`} alt="Retail lottery scratch-off dispenser rack" className="hero-rack-img hero-visual-photo" loading="eager" />
                    <figcaption className="rack-caption">Physical dispenser rack</figcaption>
                  </figure>
                  <figure>
                    <img src={`${IMG}/screenshots/cashier-screen.png`} alt="LottoTrack Pro counter screen with active dispenser boxes, live ticket counts and day settlement" className="hero-rack-img hero-visual-screen" loading="eager" />
                    <figcaption className="rack-caption">LottoTrack Pro at the counter</figcaption>
                  </figure>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Problem */}
        <section className="section section-problem-open" aria-labelledby="problem-heading">
          <div className="container">
            <div className="problem-layout-open">
              <div className="problem-header">
                <span className="eyebrow">The Challenge</span>
                <h2 id="problem-heading" className="section-h2">Lottery paperwork is slow. Mistakes make it worse.</h2>
                <p className="section-lead">At the end of a busy shift, you shouldn't have to rebuild what happened from handwritten notes and a calculator.</p>
              </div>
              <div className="problem-points-col">
                <ul className="problem-points-list">
                  {[
                    'Writing ticket numbers by hand takes time and gives mistakes another place to start.',
                    'One wrong number can throw off your sales and your reconciliation.',
                    "The drawer doesn't match, and now you have to work out where the difference came from.",
                    "Inventory isn't clear. You shouldn't have to check every box just to know what's left."
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
            <h2 id="how-heading" className="section-h2">Three things happen. You do the scanning.</h2>
            <div className="how-steps-grid">
              {[
                ['Scan it.', 'Scan a pack when it arrives. Scan a ticket when you sell it. No typing long ticket numbers.'],
                ['LottoTrack keeps up.', 'Inventory, ticket positions, sales and sold-out packs update as you work.'],
                ['Get the report.', 'When the shift is finished, your reports are ready to print, export or email.']
              ].map(([title, desc], i) => (
                <div key={title} className="how-step-card">
                  <span className="how-step-badge">{i + 1}</span>
                  <h3 className="how-step-title">{title}</h3>
                  <p className="how-step-desc">{desc}</p>
                </div>
              ))}
            </div>
            <p className="closing-statement">You scan. LottoTrack keeps the record.</p>
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
            <h2 id="benefits-heading" className="section-h2">Less paperwork for you. Less guesswork for them.</h2>
            <div className="perspectives-grid">
              <div className="perspective-block">
                <h3 className="perspective-role-title">For the store owner:</h3>
                <ul className="perspective-features-list">
                  <li>Save time at the end of the shift. Sales are calculated from the ticket positions recorded during the shift.</li>
                  <li>Catch problems early. See whether the drawer is balanced, over or short.</li>
                  <li>Know what's in your rack. See active packs, tickets remaining, sold-out packs and stored inventory.</li>
                  <li>Check in without being there. Add an email in Settings and receive the shift report when the shift closes.</li>
                </ul>
                <div className="perspective-visuals-stack"><Shot file="rack.png" alt="Lottery inventory status dashboard" /></div>
              </div>
              <div className="perspective-block">
                <h3 className="perspective-role-title">For the person behind the counter:</h3>
                <ul className="perspective-features-list">
                  <li>Large controls. Clear buttons and number pads make common actions easy.</li>
                  <li>Spoken prompts. Audio feedback guides scanning and workflow steps.</li>
                  <li>Built-in quick guide. The basic workflow is explained inside the system.</li>
                  <li>Easy shift handoff. Switch the active cashier and continue with the next shift.</li>
                </ul>
                <div className="perspective-visuals-stack"><Shot file="cashier-screen.png" alt="LottoTrack Pro counter screen with large +1 sell buttons and live totals" /></div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Reconciliation */}
        <section className="section" aria-labelledby="reconciliation-heading">
          <div className="container">
            <h2 id="reconciliation-heading" className="section-h2">Know what the drawer should contain.</h2>
            <p className="section-lead">Ticket sales, payouts and your starting float come together to calculate the cash you should have. Online sales and cashouts can be entered too.</p>
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
              <p className="reconciliation-outcomes-header">If the numbers don't match, you'll see Over or Short.</p>
              <div className="reconciliation-outcomes-grid">
                <div className="outcome-card is-balanced"><div className="outcome-status">Balanced</div><div className="outcome-detail">($466 counted against expected $466)</div></div>
                <div className="outcome-card is-over"><div className="outcome-status">Over</div><div className="outcome-detail">($480 counted against expected $466)</div></div>
                <div className="outcome-card is-short"><div className="outcome-status">Short</div><div className="outcome-detail">($450 counted against expected $466)</div></div>
              </div>
              <span className="illustration-notice">Example figures shown for illustration.</span>
            </div>
          </div>
        </section>

        {/* 7. Fix mistakes */}
        <section className="section" aria-labelledby="mistakes-heading">
          <div className="container">
            <h2 id="mistakes-heading" className="section-h2">Made a mistake? Fix it.</h2>
            <div className="fix-mistakes-panel">
              <div className="workflow-correction-strip" role="region" aria-label="Example workflow demonstrating position correction">
                <span className="correction-badge-wrong">ticket entered 0187</span>
                <span className="correction-arrow" aria-hidden="true">&gt;</span>
                <span className="correction-badge-action">Fix Position</span>
                <span className="correction-arrow" aria-hidden="true">&gt;</span>
                <span className="correction-badge-fixed">correct position 0186</span>
              </div>
              <ul className="fix-mistakes-list">
                <li>Wrong ticket number? Use Fix Position.</li>
                <li>Wrong box? Switch boxes or change the box number.</li>
                <li>Pack finished? Mark it sold out.</li>
                <li>Taking a pack off the counter? Return it to the Lottery or move it to storage for later.</li>
              </ul>
              <span className="illustration-notice">Example workflow.</span>
            </div>
            <p className="closing-statement">You don't have to start over because one number was wrong.</p>
          </div>
        </section>

        {/* 8. Pricing (replaces the demo request) */}
        <section id="pricing" className="section" aria-labelledby="pricing-heading">
          <div className="container">
            <div className="pricing-wrapper">
              <div className="pricing-pitch">
                <span className="eyebrow">Pricing</span>
                <h2 id="pricing-heading" className="section-h2">One price. Yours for good.</h2>
                <p className="section-lead">
                  Pay once and LottoTrack Pro is licensed to your store. Your license key is created the moment payment goes through, so you can sign in and start your first shift right away.
                </p>
                <ul className="compact-feature-list">
                  <li className="compact-feature-item"><strong>Dispenser rack:</strong> the game, ticket position and tickets left for every box.</li>
                  <li className="compact-feature-item"><strong>Reports:</strong> shift, day, receipt, email and export.</li>
                  <li className="compact-feature-item"><strong>Shift tracking:</strong> shift mode or daily mode.</li>
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
