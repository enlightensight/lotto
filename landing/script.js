/**
 * ============================================================================
 * LottoTrack Pro - Standalone Marketing Landing Page Script
 * Pure Vanilla JavaScript • Zero Dependencies • Progressive Enhancement
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. Configuration Block
// ----------------------------------------------------------------------------
const CONFIG = {
  COMPANY_NAME: "",
  PHONE: "",
  EMAIL: "",
  FORM_ENDPOINT: ""
};

// ----------------------------------------------------------------------------
// 2. DOM Initialization & Progressive Enhancement
// ----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Mark document as JS-enabled
  document.documentElement.classList.add("js-enabled");

  // Populate config placeholders
  populateConfigValues();

  // Initialize interactive components
  initScreenshotFrames();
  initReportsTabs();
  initSingleOpenFAQ();
  initDemoForm();
  initContactToggle();
  initMobileNav();
  initSubscriptionFlow();
});

/**
 * Replace config placeholders with real values or bracketed placeholders
 */
function populateConfigValues() {
  const companyElements = document.querySelectorAll("[data-config='COMPANY_NAME']");
  const phoneElements = document.querySelectorAll("[data-config='PHONE']");
  const emailElements = document.querySelectorAll("[data-config='EMAIL']");

  const companyDisplay = CONFIG.COMPANY_NAME.trim() || "[COMPANY NAME]";
  const phoneDisplay = CONFIG.PHONE.trim() || "[PHONE NUMBER]";
  const emailDisplay = CONFIG.EMAIL.trim() || "[EMAIL ADDRESS]";

  companyElements.forEach((el) => {
    el.textContent = companyDisplay;
  });

  phoneElements.forEach((el) => {
    el.textContent = phoneDisplay;
    if (CONFIG.PHONE.trim() && el.tagName === "A") {
      el.setAttribute("href", `tel:${CONFIG.PHONE.replace(/[^0-9+]/g, "")}`);
    }
  });

  emailElements.forEach((el) => {
    el.textContent = emailDisplay;
    if (CONFIG.EMAIL.trim() && el.tagName === "A") {
      el.setAttribute("href", `mailto:${CONFIG.EMAIL.trim()}`);
    }
  });
}

/**
 * Handle 16:10 Screenshot Loading and Fallbacks
 */
function initScreenshotFrames() {
  const frames = document.querySelectorAll(".screenshot-frame");

  frames.forEach((frame) => {
    const img = frame.querySelector("img");
    if (!img) return;

    // Handler when image loads successfully
    const handleSuccess = () => {
      frame.classList.add("has-loaded");
      frame.classList.remove("has-failed");
    };

    // Handler when image file is missing or fails
    const handleError = () => {
      frame.classList.add("has-failed");
      frame.classList.remove("has-loaded");
    };

    if (img.complete) {
      if (img.naturalWidth > 0) {
        handleSuccess();
      } else {
        handleError();
      }
    } else {
      img.addEventListener("load", handleSuccess);
      img.addEventListener("error", handleError);
    }
  });
}

/**
 * Accessible Tabbed Reports Component
 * In HTML, all panels display stacked by default for no-JS environments.
 * When JS runs, we hide inactive panels and enable ARIA tabs & arrow key nav.
 */
function initReportsTabs() {
  const tablist = document.querySelector(".reports-tablist");
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  if (!tabs.length || !panels.length) return;

  // Set initial active tab (first one)
  activateTab(tabs[0], tabs, panels, false);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab, tabs, panels, true);
    });

    // Arrow navigation per WAI-ARIA tab pattern
    tab.addEventListener("keydown", (e) => {
      let index = tabs.indexOf(tab);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (index + 1) % tabs.length;
        tabs[next].focus();
        activateTab(tabs[next], tabs, panels, true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = (index - 1 + tabs.length) % tabs.length;
        tabs[prev].focus();
        activateTab(tabs[prev], tabs, panels, true);
      } else if (e.key === "Home") {
        e.preventDefault();
        tabs[0].focus();
        activateTab(tabs[0], tabs, panels, true);
      } else if (e.key === "End") {
        e.preventDefault();
        tabs[tabs.length - 1].focus();
        activateTab(tabs[tabs.length - 1], tabs, panels, true);
      }
    });
  });
}

function activateTab(targetTab, allTabs, allPanels, setFocus) {
  allTabs.forEach((tab) => {
    const isSelected = tab === targetTab;
    tab.setAttribute("aria-selected", isSelected ? "true" : "false");
    tab.setAttribute("tabindex", isSelected ? "0" : "-1");
  });

  const targetPanelId = targetTab.getAttribute("aria-controls");

  allPanels.forEach((panel) => {
    if (panel.id === targetPanelId) {
      panel.hidden = false;
      panel.style.display = "block";
    } else {
      panel.hidden = true;
      panel.style.display = "none";
    }
  });

  if (setFocus) {
    targetTab.focus();
  }
}

/**
 * FAQ Accordion: Ensure only one <details> is open at a time
 */
function initSingleOpenFAQ() {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) {
        faqItems.forEach((other) => {
          if (other !== item && other.open) {
            other.removeAttribute("open");
          }
        });
      }
    });
  });
}

/**
 * Request a Demo Form Handler
 * Validates fields on client side, manages honeypot anti-spam,
 * handles FORM_ENDPOINT or mailto: fallback with exact entered details.
 */
function initDemoForm() {
  const form = document.getElementById("demo-request-form");
  if (!form) return;

  const feedbackBox = document.getElementById("form-feedback-message");
  const submitBtn = document.getElementById("demo-submit-btn");

  const nameInput = document.getElementById("demo-name");
  const emailInput = document.getElementById("demo-email");
  const phoneInput = document.getElementById("demo-phone");
  const storeInput = document.getElementById("demo-store");
  const stateInput = document.getElementById("demo-state");
  const messageInput = document.getElementById("demo-message");
  const honeypotInput = document.getElementById("form-hp-website");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Check honeypot spam bot
    if (honeypotInput && honeypotInput.value.trim() !== "") {
      console.warn("Spam submission prevented.");
      return;
    }

    // Reset previous errors
    clearFieldErrors();
    feedbackBox.className = "form-feedback-box";
    feedbackBox.innerHTML = "";

    // Client Validation
    let hasError = false;

    if (!nameInput.value.trim()) {
      showFieldError(nameInput, "Please enter your name.");
      hasError = true;
    }

    const emailValue = emailInput.value.trim();
    if (!emailValue) {
      showFieldError(emailInput, "Please enter your email address.");
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      showFieldError(emailInput, "Please enter a valid email address.");
      hasError = true;
    }

    if (hasError) {
      const firstInvalid = form.querySelector(".has-error input, .has-error select");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const formData = {
      name: nameInput.value.trim(),
      email: emailValue,
      phone: phoneInput.value.trim(),
      store: storeInput.value.trim(),
      state: stateInput.value.trim(),
      message: messageInput.value.trim(),
      submittedAt: new Date().toISOString()
    };

    // Case 1: FORM_ENDPOINT is set -> POST JSON
    if (CONFIG.FORM_ENDPOINT && CONFIG.FORM_ENDPOINT.trim() !== "") {
      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Sending...";

      try {
        const response = await fetch(CONFIG.FORM_ENDPOINT.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          feedbackBox.className = "form-feedback-box is-success";
          feedbackBox.innerHTML = `<strong>Request sent!</strong> Thank you, ${escapeHtml(formData.name)}. We will be in touch shortly.`;
          form.reset();
        } else {
          throw new Error(`Server returned ${response.status}`);
        }
      } catch (err) {
        feedbackBox.className = "form-feedback-box is-error";
        feedbackBox.innerHTML = `<strong>Submission failed:</strong> Unable to send your request. Please email us directly or try again later.`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    } 
    // Case 2: FORM_ENDPOINT is empty -> Show "not connected yet" + mailto: fallback
    else {
      const recipient = CONFIG.EMAIL.trim() || "[EMAIL ADDRESS]";
      const emailSubject = encodeURIComponent(`LottoTrack Pro Demo Request: ${formData.name}`);
      const emailBody = encodeURIComponent(
        `Hello,\n\nI would like to request a demo of LottoTrack Pro.\n\n` +
        `Name: ${formData.name}\n` +
        `Email: ${formData.email}\n` +
        `Phone: ${formData.phone || 'Not provided'}\n` +
        `Store/Company: ${formData.store || 'Not provided'}\n` +
        `State: ${formData.state || 'Not provided'}\n` +
        `What I'd like to see: ${formData.message || 'General demonstration'}\n\n` +
        `Sent from LottoTrack Pro landing page.`
      );
      const mailtoUrl = `mailto:${recipient}?subject=${emailSubject}&body=${emailBody}`;

      feedbackBox.className = "form-feedback-box is-info";
      feedbackBox.innerHTML = `
        <strong>This form is not connected yet.</strong><br>
        To send your request directly, <a href="${mailtoUrl}" style="text-decoration: underline; font-weight: 600;">click here to email ${escapeHtml(recipient)}</a> with your entered details.
      `;
    }
  });
}

function showFieldError(inputEl, msg) {
  const group = inputEl.closest(".form-group");
  if (!group) return;
  group.classList.add("has-error");
  const errorEl = group.querySelector(".field-error-msg");
  if (errorEl) {
    errorEl.textContent = msg;
  }
}

function clearFieldErrors() {
  document.querySelectorAll(".form-group.has-error").forEach((group) => {
    group.classList.remove("has-error");
    const errorEl = group.querySelector(".field-error-msg");
    if (errorEl) {
      errorEl.textContent = "";
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Talk to Us Interaction: Displays phone & email info
 */
function initContactToggle() {
  const talkButtons = document.querySelectorAll(".talk-to-us-btn");
  const contactCard = document.getElementById("talk-to-us-info");

  talkButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (contactCard) {
        contactCard.hidden = false;
        contactCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
        contactCard.focus?.();
      }
    });
  });
}

/**
 * Mobile Navigation Menu
 */
function initMobileNav() {
  const toggleBtn = document.querySelector(".mobile-nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener("click", () => {
    const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", !isExpanded);
    navLinks.classList.toggle("is-open", !isExpanded);
  });

  // Close when clicking any nav link
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      toggleBtn.setAttribute("aria-expanded", "false");
      navLinks.classList.remove("is-open");
    });
  });
}

/**
 * Subscription-Required POS Account Creation & POS Portal Sign-In
 */
function initSubscriptionFlow() {
  const DEFAULT_PLANS = [
    {
      id: "starter",
      name: "Starter",
      priceMonthly: 49,
      priceAnnual: 490,
      features: [
        "1 retail store counter",
        "Scratch-off box & shift tracking",
        "Automated settlement & audit log"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      priceMonthly: 99,
      priceAnnual: 990,
      features: [
        "Unlimited scratch-off boxes & packs",
        "Honeywell barcode scanner + voice count",
        "Multi-user cashiers & shift reports"
      ]
    },
    {
      id: "enterprise",
      name: "Enterprise",
      priceMonthly: 179,
      priceAnnual: 1790,
      features: [
        "Priority compliance & license review",
        "Extended audit log retention",
        "Dedicated store setup assistance"
      ]
    }
  ];

  const DRAFT_KEY = "jackpotlo_landing_checkout_draft";
  let plans = DEFAULT_PLANS;
  let activeBillingCycle = "monthly";
  let posPortalUrl = "/pos";
  let verifiedCheckoutSessionId = "";

  const modal = document.getElementById("subscribe-modal");
  const form = document.getElementById("subscribe-account-form");
  const feedbackEl = document.getElementById("sub-form-feedback");
  const planSelect = document.getElementById("sub-plan");
  const billingSelect = document.getElementById("sub-billing-cycle");
  const totalEl = document.getElementById("sub-selected-total");
  const submitBtn = document.getElementById("sub-submit-btn");
  const successPanel = document.getElementById("sub-success-panel");
  const launchPosBtn = document.getElementById("sub-launch-pos-btn");

  if (!modal || !form) return;

  function apiFetch(path, options) {
    if (window.location.protocol === "file:") {
      return fetch(`http://localhost:3001${path}`, options);
    }
    return fetch(path, options).then((res) => {
      if (res.status === 404 && ["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3001") {
        return fetch(`http://localhost:3001${path}`, options);
      }
      return res;
    });
  }

  function applyPosLinks(baseUrl) {
    posPortalUrl = baseUrl;
    const signInUrl = `${baseUrl}?signin=1`;
    document.querySelectorAll(".js-open-pos-signin").forEach((el) => {
      if (el.tagName === "A") el.setAttribute("href", signInUrl);
    });
    if (launchPosBtn) launchPosBtn.setAttribute("href", baseUrl);
  }

  // Detect whether root "/" serves the POS app (Vite/Netlify) or API JSON (Express), with localhost fallback
  if (window.location.protocol === "file:") {
    applyPosLinks("http://localhost:3001/pos");
  } else {
    applyPosLinks("/pos");
    fetch("/")
      .then(async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/html")) {
          const html = await res.text();
          if (html.includes("viewSignIn")) {
            applyPosLinks("/");
            return;
          }
          if (["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "3001") {
            applyPosLinks("http://localhost:3001/pos");
            return;
          }
        }
        applyPosLinks("/pos");
      })
      .catch(() => {});
  }

  function setFeedback(message, type) {
    if (!feedbackEl) return;
    feedbackEl.textContent = message || "";
    feedbackEl.className = type ? `form-feedback-box is-${type}` : "form-feedback-box";
  }

  function updateSummaryPrice() {
    if (!planSelect || !billingSelect || !totalEl) return;
    const plan = plans.find((p) => p.id === planSelect.value) || plans[1] || plans[0];
    const isAnnual = billingSelect.value === "annual";
    const amount = isAnnual ? Number(plan.priceAnnual) : Number(plan.priceMonthly);
    totalEl.innerHTML = `Selected total: <strong>$${amount.toFixed(2)} / ${isAnnual ? "year" : "month"}</strong>`;
  }

  function renderPlanCards() {
    const grid = document.getElementById("landing-plans-grid");
    if (!grid) return;
    grid.innerHTML = plans.map((plan) => {
      const isPopular = plan.id === "pro";
      const price = activeBillingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
      const suffix = activeBillingCycle === "annual" ? "/yr" : "/mo";
      const features = Array.isArray(plan.features) ? plan.features : [];
      return `
        <article class="plan-card${isPopular ? " is-popular" : ""}" data-plan-id="${plan.id}">
          <div class="plan-card-header">
            ${isPopular ? '<span class="plan-badge">Most Popular</span>' : ""}
            <h3 class="plan-name">${plan.name}</h3>
            <p class="plan-desc">${plan.tagline || ""}</p>
          </div>
          <div class="plan-price">$${price}<span>${suffix}</span></div>
          <ul class="plan-features">
            ${features.map((f) => `<li>${f}</li>`).join("")}
          </ul>
          <button type="button" class="btn ${isPopular ? "btn-primary" : "btn-secondary"} js-select-plan-btn" data-plan-id="${plan.id}">
            Subscribe &amp; Create Account
          </button>
        </article>
      `;
    }).join("");

    if (planSelect) {
      const prev = planSelect.value;
      planSelect.innerHTML = plans.map((p) => (
        `<option value="${p.id}">${p.name} ($${p.priceMonthly}/mo • $${p.priceAnnual}/yr)</option>`
      )).join("");
      if (plans.some((p) => p.id === prev)) planSelect.value = prev;
    }
    updateSummaryPrice();
  }

  function openModal(planId) {
    if (planId && planSelect && plans.some((p) => p.id === planId)) {
      planSelect.value = planId;
    }
    if (billingSelect) {
      billingSelect.value = activeBillingCycle;
    }
    updateSummaryPrice();
    if (typeof modal.showModal === "function") {
      if (!modal.open) modal.showModal();
    } else {
      modal.setAttribute("open", "open");
    }
  }

  function closeModal() {
    if (typeof modal.close === "function" && modal.open) {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
  }

  // Fetch authoritative subscription plans from backend API
  apiFetch("/api/subscription/plans")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data?.success && Array.isArray(data.plans) && data.plans.length > 0) {
        plans = data.plans.map((p) => ({
          ...p,
          features: p.id === "starter"
            ? ["1 retail store counter", "Scratch-off box & shift tracking", "Automated settlement & audit log"]
            : p.id === "enterprise"
              ? ["Priority compliance & license review", "Extended audit log retention", "Dedicated store setup assistance"]
              : ["Unlimited scratch-off boxes & packs", "Honeywell barcode scanner + voice count", "Multi-user cashiers & shift reports"]
        }));
        renderPlanCards();
      }
    })
    .catch(() => {});

  document.querySelectorAll(".billing-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeBillingCycle = btn.dataset.billingCycle === "annual" ? "annual" : "monthly";
      document.querySelectorAll(".billing-toggle-btn").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      renderPlanCards();
    });
  });

  document.addEventListener("click", (e) => {
    const planBtn = e.target.closest(".js-select-plan-btn, .js-open-subscribe-modal");
    if (planBtn) {
      e.preventDefault();
      openModal(planBtn.dataset.planId || "pro");
      return;
    }
    const signInEl = e.target.closest(".js-open-pos-signin");
    if (signInEl) {
      e.preventDefault();
      window.location.href = `${posPortalUrl}?signin=1`;
    }
  });

  document.getElementById("subscribe-modal-close")?.addEventListener("click", closeModal);
  document.getElementById("sub-cancel-btn")?.addEventListener("click", closeModal);
  planSelect?.addEventListener("change", updateSummaryPrice);
  billingSelect?.addEventListener("change", updateSummaryPrice);

  function readUploadedFiles() {
    const input = document.getElementById("sub-license-files");
    const files = input?.files ? Array.from(input.files).slice(0, 6) : [];
    return Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size || 0,
        dataUrl: typeof reader.result === "string" ? reader.result : ""
      });
      reader.onerror = () => resolve({ name: file.name, type: file.type, size: file.size });
      reader.readAsDataURL(file);
    })));
  }

  function persistPosSession(data) {
    if (!data?.token || !data?.storeId) return;
    const statuses = data.statuses || {};
    const username = data.user?.username || data.user?.email || "";
    const payload = JSON.stringify({
      name: data.user?.name || "Store Owner",
      username,
      signInName: username,
      email: data.user?.email || "",
      storeId: data.storeId,
      retailerNumber: data.retailerNumber || "",
      activeView: "pos",
      isAdmin: false,
      role: data.user?.role || "Owner",
      adminToken: "",
      storeToken: data.token,
      ...statuses,
      loginAt: new Date().toISOString()
    });
    sessionStorage.removeItem("lotto_signed_out");
    localStorage.removeItem("lotto_signed_out");
    sessionStorage.removeItem("lotto_admin_token");
    localStorage.removeItem("lotto_admin_token");
    sessionStorage.setItem("lotto_store_token", data.token);
    localStorage.setItem("lotto_store_token", data.token);
    sessionStorage.setItem("lotto_current_store_id", data.storeId);
    localStorage.setItem("lotto_current_store_id", data.storeId);
    sessionStorage.setItem("lotto_session_user", payload);
    localStorage.setItem("lotto_session_user", payload);
    localStorage.setItem("lotto_remembered_user", data.user?.email || username);
  }

  function collectDraftFields() {
    return {
      planId: planSelect?.value || "pro",
      billingCycle: billingSelect?.value || "monthly",
      storeName: document.getElementById("sub-store-name")?.value.trim() || "",
      applicantName: document.getElementById("sub-owner-name")?.value.trim() || "",
      applicantEmail: document.getElementById("sub-email")?.value.trim() || "",
      applicantPhone: document.getElementById("sub-phone")?.value.trim() || "",
      address: document.getElementById("sub-address")?.value.trim() || "",
      username: document.getElementById("sub-username")?.value.trim() || "",
      lotteryRetailerId: document.getElementById("sub-retailer-id")?.value.trim() || "",
      businessTaxId: document.getElementById("sub-tax-id")?.value.trim() || "",
      licenseExpiry: document.getElementById("sub-license-expiry")?.value.trim() || ""
    };
  }

  function restoreDraftFields(draft) {
    if (!draft || typeof draft !== "object") return;
    if (draft.planId && planSelect) planSelect.value = draft.planId;
    if (draft.billingCycle && billingSelect) billingSelect.value = draft.billingCycle;
    const map = {
      "sub-store-name": draft.storeName,
      "sub-owner-name": draft.applicantName,
      "sub-email": draft.applicantEmail,
      "sub-phone": draft.applicantPhone,
      "sub-address": draft.address,
      "sub-username": draft.username,
      "sub-retailer-id": draft.lotteryRetailerId,
      "sub-tax-id": draft.businessTaxId,
      "sub-license-expiry": draft.licenseExpiry
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && typeof val === "string") el.value = val;
    });
    updateSummaryPrice();
  }

  // Handle return from external Stripe Checkout redirect
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout_cancelled") === "1") {
    openModal();
    setFeedback("Subscription payment was cancelled. Your store account was not created.", "error");
  } else if (params.get("checkout_session_id")) {
    verifiedCheckoutSessionId = params.get("checkout_session_id") || "";
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (saved) restoreDraftFields(saved);
    } catch (_) {}
    openModal();
    if (submitBtn) submitBtn.textContent = "Complete Paid Account Activation";
    setFeedback("Payment session verified. Enter your POS login password and click Complete Paid Account Activation.", "info");
    document.getElementById("sub-password")?.focus();
  }

  function setFieldError(inputId, msg) {
    const input = document.getElementById(inputId);
    const group = input?.closest(".form-group");
    if (!group) return;
    const errEl = group.querySelector(".field-error-msg");
    if (msg) {
      group.classList.add("has-error");
      if (errEl) errEl.textContent = msg;
    } else {
      group.classList.remove("has-error");
      if (errEl) errEl.textContent = "";
    }
  }

  function clearAllFieldErrors() {
    form.querySelectorAll(".form-group.has-error").forEach((g) => g.classList.remove("has-error"));
    form.querySelectorAll(".field-error-msg").forEach((el) => { el.textContent = ""; });
  }

  function validateSubscribeFields() {
    clearAllFieldErrors();
    const rules = [
      { id: "sub-plan", label: "Subscription Plan", check: (v) => Boolean(v.trim()), msg: "Please select a subscription plan." },
      { id: "sub-billing-cycle", label: "Billing Cycle", check: (v) => Boolean(v.trim()), msg: "Please choose monthly or annual billing." },
      { id: "sub-store-name", label: "Store / Business Name", check: (v) => Boolean(v.trim()), msg: "Store / Business Name is required." },
      { id: "sub-owner-name", label: "Owner / Applicant Name", check: (v) => Boolean(v.trim()), msg: "Owner / Applicant Name is required." },
      { id: "sub-email", label: "Business Email", check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), msg: "Enter a valid business email address." },
      { id: "sub-phone", label: "Phone Number", check: (v) => Boolean(v.trim()), msg: "Phone Number is required." },
      { id: "sub-address", label: "Physical Store Street Address", check: (v) => Boolean(v.trim()), msg: "Physical Store Street Address is required." },
      { id: "sub-username", label: "POS Login ID / Username", check: (v) => v.trim().length >= 3, msg: "POS Login ID is required (min 3 characters)." },
      { id: "sub-password", label: "POS Login Password", check: (v) => v.length >= 4, msg: "POS Login Password is required (min 4 characters)." }
    ];
    const invalid = [];
    for (const r of rules) {
      const el = document.getElementById(r.id);
      const val = el ? el.value : "";
      if (!r.check(val)) {
        setFieldError(r.id, r.msg);
        invalid.push({ el, label: r.label });
      }
    }
    if (invalid.length > 0) {
      const names = invalid.length > 3
        ? `${invalid.slice(0, 3).map((x) => x.label).join(", ")} (+${invalid.length - 3} more)`
        : invalid.map((x) => x.label).join(", ");
      setFeedback(`Please complete the highlighted required field(s): ${names}.`, "error");
      invalid[0].el?.scrollIntoView({ behavior: "smooth", block: "center" });
      invalid[0].el?.focus?.();
      return false;
    }
    return true;
  }

  form.querySelectorAll("input, select").forEach((el) => {
    const clearFn = () => setFieldError(el.id, "");
    el.addEventListener("input", clearFn);
    el.addEventListener("change", clearFn);
  });

  // Password show/hide toggle inside modal
  const togglePassBtn = document.getElementById("sub-toggle-password");
  const passInput = document.getElementById("sub-password");
  togglePassBtn?.addEventListener("click", () => {
    if (!passInput) return;
    const isHidden = passInput.type === "password";
    passInput.type = isHidden ? "text" : "password";
    togglePassBtn.textContent = isHidden ? "Hide" : "Show";
    togglePassBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  });

  // Styled file upload trigger + selected file label
  const fileInputEl = document.getElementById("sub-license-files");
  const pickFilesBtn = document.getElementById("sub-pick-files-btn");
  const filesListEl = document.getElementById("sub-license-files-list");
  pickFilesBtn?.addEventListener("click", () => fileInputEl?.click());
  fileInputEl?.addEventListener("change", () => {
    if (!filesListEl) return;
    const count = fileInputEl.files?.length || 0;
    if (count === 0) {
      filesListEl.textContent = "No files attached";
    } else if (count === 1) {
      filesListEl.textContent = fileInputEl.files[0].name;
    } else {
      filesListEl.textContent = `${count} files selected`;
    }
  });

  // Surface gateway status notice cleanly inside modal if Stripe keys aren't active
  const gatewayWarnEl = document.getElementById("sub-gateway-warning");
  apiFetch("/api/payments/config")
    .then((r) => (r.ok ? r.json() : null))
    .then((cfg) => {
      if (gatewayWarnEl && cfg?.success && !cfg.configured && !cfg.testHarnessEnabled) {
        gatewayWarnEl.hidden = false;
        gatewayWarnEl.textContent = "Checkout notice: Live Stripe keys (STRIPE_SECRET_KEY) are not configured on this server yet, so paid checkout cannot process here.";
      }
    })
    .catch(() => {});

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setFeedback("", "");

    if (!validateSubscribeFields()) {
      return;
    }

    const draft = collectDraftFields();
    const password = document.getElementById("sub-password")?.value || "";

    const origText = submitBtn?.textContent || "Subscribe & Create Account";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Verifying Subscription Payment...";
    }

    try {
      let paymentSessionId = verifiedCheckoutSessionId;
      if (!paymentSessionId) {
        const checkoutRes = await apiFetch("/api/payments/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: draft.planId,
            billingCycle: draft.billingCycle,
            returnOrigin: window.location.origin,
            returnPath: window.location.pathname || "/landing/"
          })
        });
        const checkoutData = await checkoutRes.json();
        if (!checkoutRes.ok || !checkoutData?.success) {
          throw new Error(checkoutData?.message || "A verified subscription payment is required before creating a POS account.");
        }
        if (checkoutData.checkoutUrl) {
          // Persist non-sensitive form fields across external Stripe Checkout redirect (never store plaintext password)
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
          window.location.href = checkoutData.checkoutUrl;
          return;
        }
        paymentSessionId = checkoutData.sessionId || "";
      }

      const licenseFiles = await readUploadedFiles();
      const regRes = await apiFetch("/api/subscriptions/checkout-and-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          password,
          paymentSessionId,
          licenseFiles
        })
      });
      const regData = await regRes.json();
      if (!regRes.ok || !regData?.success) {
        throw new Error(regData?.message || "Subscription checkout could not be completed.");
      }

      localStorage.removeItem(DRAFT_KEY);
      persistPosSession(regData);
      form.hidden = true;
      if (successPanel) {
        successPanel.hidden = false;
        const st = regData.statuses || {};
        document.getElementById("sub-status-sub").textContent = st.subscriptionStatus || "ACTIVE";
        document.getElementById("sub-status-access").textContent = st.softwareAccessStatus || "ACTIVE";
        document.getElementById("sub-status-docs").textContent = st.documentStatus || "PENDING_REVIEW";
        document.getElementById("sub-status-retailer").textContent = st.retailerAuthStatus || "PENDING_VERIFICATION";
        const summary = document.getElementById("sub-success-summary");
        if (summary) {
          summary.textContent = `Store "${regData.storeName}" is active. Login ID: ${regData.user?.username || draft.applicantEmail}.`;
        }
      }
      if (launchPosBtn) {
        launchPosBtn.setAttribute("href", posPortalUrl);
      }
    } catch (err) {
      setFeedback(err.message || "Unable to complete subscription and account creation.", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    }
  });
}
