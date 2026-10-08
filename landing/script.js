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
