(() => {
  "use strict";

  // Measure fixed UI so content and anchor targets remain accessible after resizing.
  const layoutHeader = document.querySelector(".header");
  const syncLayout = () => {
    const height = layoutHeader?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty("--header-height", `${height}px`);
    const fixed = layoutHeader && getComputedStyle(layoutHeader).position === "fixed";
    document.documentElement.style.setProperty("--header-flow-offset", `${fixed ? height : 0}px`);
    const openMenu = document.querySelector(".mobile-nav:not([hidden])");
    if (openMenu) openMenu.style.top = `${height}px`;
  };
  syncLayout();
  window.addEventListener("resize", syncLayout);
  if ("ResizeObserver" in window) {
    const layoutObserver = new ResizeObserver(syncLayout);
    if (layoutHeader) layoutObserver.observe(layoutHeader);
  }

  // Contacts: personal chats and editorial channels have distinct destinations.
  const personalTelegramUrl = "https://t.me/Alekdvv";
  const whatsappUrl = "https://wa.me/79112815471";
  const maxChannelUrl = "https://max.ru/join/k2QL7Pt9u58fANz_TeDPS4544NNb7YW2O73SHhbTSmk";
  const contactAssets = new URL("assets/", document.currentScript.src);

  // Fill in only after the owner supplies and confirms a personal MAX profile.
  const maxDirectProfileUrl = "";
  const maxDirectProfileVerified = false;
  const populateMaxDirectSlots = () => {
    if (!maxDirectProfileUrl || !maxDirectProfileVerified) return;
    try {
      const profile = new URL(maxDirectProfileUrl);
      const isProfile = profile.protocol === "https:" && profile.hostname === "max.ru" &&
        profile.pathname !== "/" && !profile.pathname.startsWith("/join/");
      if (isProfile) document.querySelectorAll("[data-max-direct-slot]").forEach((slot) => {
        const link = document.createElement("a");
        link.href = profile.href;
        link.textContent = "MAX — личные сообщения";
        link.dataset.maxDirect = "";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        slot.replaceChildren(link);
        slot.hidden = false;
      });
    } catch { /* Keep the control unpublished for empty or invalid configuration. */ }
  };
  populateMaxDirectSlots();

  // Mobile navigation: clones the current page's desktop nav, preserving relative links.
  const toggle = document.querySelector(".menu-toggle");
  const desktopNav = document.querySelector(".nav");
  let mobileNav = null;
  let lastFocused = null;

  if (toggle && desktopNav) {
    mobileNav = document.createElement("nav");
    mobileNav.id = "mobile-menu";
    mobileNav.className = "mobile-nav";
    mobileNav.setAttribute("aria-label", "Мобильная навигация");
    mobileNav.hidden = true;
    mobileNav.innerHTML = `<div class="mobile-nav__inner">${desktopNav.innerHTML}<a class="mobile-nav__contact" href="${personalTelegramUrl}" target="_blank" rel="noopener noreferrer" data-contact-chooser aria-haspopup="dialog" aria-controls="contact-chooser" aria-expanded="false" role="button" data-goal="contact_chooser_open">Обсудить задачу ↗</a></div>`;
    document.body.appendChild(mobileNav);

    const setMenu = (open) => {
      if (open) closeContacts(false);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      mobileNav.style.top = `${document.querySelector(".header")?.getBoundingClientRect().height || 0}px`;
      mobileNav.hidden = !open;
      document.body.classList.toggle("menu-open", open);
      if (open) {
        lastFocused = document.activeElement;
        mobileNav.querySelector("a")?.focus();
      } else if (lastFocused === toggle || lastFocused?.closest?.(".mobile-nav")) {
        toggle.focus();
      }
    };

    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    mobileNav.addEventListener("click", (e) => {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setMenu(false);
      if (e.key === "Tab" && toggle.getAttribute("aria-expanded") === "true") {
        const focusables = [toggle, ...mobileNav.querySelectorAll("a,button,[tabindex]:not([tabindex='-1'])")];
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1000 && toggle.getAttribute("aria-expanded") === "true") setMenu(false);
    });
  }


  // One floating, non-modal contact window shared by every page and CTA.
  const contactWidget = document.createElement("div");
  contactWidget.className = "fr-contact-widget";
  contactWidget.innerHTML = `<dialog class="fr-contact-dialog" id="contact-chooser" aria-labelledby="contact-chooser-title">
    <div class="fr-contact-dialog__heading"><div><h2 id="contact-chooser-title">Обсудить задачу</h2></div><button class="fr-contact-dialog__close" type="button" aria-label="Закрыть выбор мессенджера">×</button></div>
    <div class="fr-contact-dialog__links">
      <a class="fr-messenger" href="${personalTelegramUrl}" target="_blank" rel="noopener noreferrer" data-goal="telegram_contact"><img src="${new URL("messenger-telegram.svg", contactAssets)}" width="30" height="30" alt=""/><span><strong>Telegram</strong></span></a>
      <a class="fr-messenger" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" data-goal="whatsapp_contact"><img src="${new URL("messenger-whatsapp.svg", contactAssets)}" width="30" height="30" alt=""/><span><strong>WhatsApp</strong></span></a>
      <a class="fr-messenger fr-messenger--channel" href="${maxChannelUrl}" target="_blank" rel="noopener noreferrer" data-max-channel><img src="${new URL("messenger-max.svg", contactAssets)}" width="30" height="30" alt=""/><span><strong>MAX</strong><small>Канал</small></span></a>
      <span data-max-direct-slot hidden></span>
    </div>
  </dialog>
  <button class="fr-contact-toggle" type="button" data-contact-chooser data-goal="contact_chooser_open" aria-haspopup="dialog" aria-controls="contact-chooser" aria-expanded="false" aria-label="Открыть способы связи"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h8M8 14h5"/></svg></button>`;
  document.body.appendChild(contactWidget);
  const contactDialog = contactWidget.querySelector("dialog");
  const contactToggle = contactWidget.querySelector(".fr-contact-toggle");
  let contactTrigger = null;
  let observedConsent = null;
  let contactFrame = 0;

  function closeContacts(restoreFocus = true) {
    if (!contactDialog.open) return;
    const outsideFocus = !contactDialog.contains(document.activeElement) ? document.activeElement : null;
    contactDialog.close();
    // A non-modal dialog can restore its original focus automatically. Preserve
    // the new target when the user tabs out, opens the menu or clicks elsewhere.
    if (!restoreFocus && outsideFocus) outsideFocus.focus({ preventScroll: true });
    document.querySelectorAll("[data-contact-chooser]").forEach((el) => el.setAttribute("aria-expanded", "false"));
    contactToggle.setAttribute("aria-label", "Открыть способы связи");
    if (restoreFocus) {
      const rect = contactTrigger?.getBoundingClientRect();
      const headerBottom = layoutHeader?.getBoundingClientRect().bottom || 0;
      const visibleTrigger = rect && rect.width && rect.height &&
        rect.bottom > (contactTrigger.closest(".header") ? 0 : headerBottom) && rect.top < innerHeight;
      const target = visibleTrigger ? contactTrigger : contactToggle;
      target.focus({ preventScroll: true });
    }
  }

  const queueContactLayout = () => {
    if (!contactFrame) contactFrame = requestAnimationFrame(() => {
      contactFrame = 0;
      syncContactLayout();
    });
  };
  const contactResize = "ResizeObserver" in window ? new ResizeObserver(queueContactLayout) : null;
  if (layoutHeader) contactResize?.observe(layoutHeader);
  function syncContactLayout() {
    const viewport = window.visualViewport;
    const viewportBottom = viewport ? Math.min(innerHeight, viewport.offsetTop + viewport.height) : innerHeight;
    contactWidget.style.setProperty("--fr-contact-viewport-offset", `${Math.max(0, innerHeight - viewportBottom)}px`);
    contactWidget.style.setProperty("--fr-contact-cookie-offset", "0px");
    const consent = document.querySelector(".cookie-consent");
    if (consent !== observedConsent) {
      if (observedConsent) contactResize?.unobserve(observedConsent);
      if (consent) contactResize?.observe(consent);
      observedConsent = consent;
    }
    const consentVisible = consent && !consent.hidden && consent.getClientRects().length && getComputedStyle(consent).visibility !== "hidden";
    if (consentVisible) {
      const banner = consent.getBoundingClientRect();
      const button = contactToggle.getBoundingClientRect();
      // The popup is wider than its launcher: reserve its full horizontal footprint.
      const popupWidth = parseFloat(getComputedStyle(contactDialog).width) || 336;
      const contactLeft = Math.min(button.left, button.right - Math.min(popupWidth, innerWidth - 32));
      if (banner.right > contactLeft - 12 && banner.left < button.right + 12) {
        contactWidget.style.setProperty("--fr-contact-cookie-offset", `${Math.max(0, button.bottom - banner.top + 12)}px`);
      }
    }
    const button = contactToggle.getBoundingClientRect();
    const headerBottom = layoutHeader?.getBoundingClientRect().bottom || 0;
    const topLimit = Math.max(headerBottom + 12, (viewport?.offsetTop || 0) + 16);
    const available = Math.max(0, button.top - 12 - topLimit);
    contactWidget.style.setProperty("--fr-contact-available-height", `${Math.floor(available)}px`);
    // An unusually tall cookie notice has priority over the chat control.
    contactWidget.toggleAttribute("data-obscured", available < 100);
    if (document.body.classList.contains("menu-open") || available < 100) closeContacts(false);
  }
  const openContacts = (trigger) => {
    if (contactDialog.open && (contactTrigger === trigger || trigger === contactToggle)) { closeContacts(); return; }
    syncContactLayout();
    if (contactWidget.hasAttribute("data-obscured")) {
      document.querySelector(".cookie-consent:not([hidden]) button")?.focus();
      return;
    }
    contactTrigger = trigger;
    populateMaxDirectSlots();
    document.querySelectorAll("[data-contact-chooser]").forEach((el) => el.setAttribute("aria-expanded", "false"));
    if (!contactDialog.open) contactDialog.show();
    trigger.setAttribute("aria-expanded", "true");
    contactToggle.setAttribute("aria-expanded", "true");
    contactToggle.setAttribute("aria-label", "Закрыть способы связи");
    contactDialog.querySelector(".fr-messenger").focus({ preventScroll: true });
  };
  contactWidget.querySelector(".fr-contact-dialog__close").addEventListener("click", () => closeContacts());
  contactDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeContacts(); });
  contactDialog.addEventListener("click", (event) => {
    if (event.target.closest("a")) setTimeout(() => closeContacts(), 0);
  });
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-contact-chooser]");
    if (trigger && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      openContacts(trigger);
    } else if (!contactWidget.contains(event.target)) {
      // Let another link or control receive focus normally after an outside click.
      const interactive = event.target.closest("a,button,input,select,textarea,summary,[tabindex]");
      closeContacts(!interactive);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && contactDialog.open) {
      event.preventDefault(); closeContacts();
    } else if (event.key === "Tab" && contactDialog.open && !event.shiftKey && event.target === contactToggle) {
      // Tab continues to the browser/page normally; this is not a modal focus trap.
      closeContacts(false);
    } else if (event.key === " " && event.target.matches("a[data-contact-chooser]")) {
      event.preventDefault(); event.target.click();
    }
  });
  document.addEventListener("focusin", (event) => {
    if (contactDialog.open && !contactWidget.contains(event.target) && !event.target.matches("[data-contact-chooser]")) closeContacts(false);
  });
  window.addEventListener("resize", queueContactLayout);
  window.addEventListener("scroll", queueContactLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", queueContactLayout);
  window.visualViewport?.addEventListener("scroll", queueContactLayout, { passive: true });
  // Cookie settings may appear after the contact widget or be reopened later.
  new MutationObserver((records) => {
    if (records.some((record) => record.target === document.body || record.target.matches?.(".cookie-consent"))) queueContactLayout();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style"] });
  syncContactLayout();

  // Subtle viewport reveals with a safe fallback.
  const revealItems = document.querySelectorAll(".reveal, .case-feature");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach(el => observer.observe(el));
  } else {
    revealItems.forEach(el => el.classList.add("in-view"));
  }

  // Privacy-first free analytics loader. IDs are intentionally empty in the prototype.
  const scriptTag = document.currentScript;
  const rootPath = scriptTag?.dataset?.root || "";
  const cfg = document.body.hasAttribute("data-private-tool") ? {} : (window.KRAVETS_ANALYTICS || {});
  const consentKey = "kravets_analytics_consent_v1";

  function currentConsent() { try { return localStorage.getItem(consentKey); } catch(e) { return null; } }
  function saveConsent(v) { try { localStorage.setItem(consentKey, v); } catch(e) {} }

  function loadCloudflare() {
    if (!cfg.cloudflareToken || document.querySelector("script[data-cf-beacon]")) return;
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: cfg.cloudflareToken }));
    document.head.appendChild(s);
  }

  function loadYandex() {
    const id = String(cfg.yandexMetricaId || "").trim();
    if (!id || window.__kravetsYmLoaded) return;
    window.__kravetsYmLoaded = true;
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();
      for (let j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
      k=e.createElement(t);a=e.getElementsByTagName(t)[0];k.async=1;k.src=r;a.parentNode.insertBefore(k,a);
    })(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
    window.ym(Number(id),"init",{defer:true,clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
  }

  loadCloudflare();

  const yandexId = String(cfg.yandexMetricaId || "").trim();
  let consentBox = null;

  function openConsent() {
    if (!consentBox) return;
    consentBox.hidden = false;
    consentBox.querySelector("button")?.focus();
  }

  if (yandexId) {
    consentBox = document.createElement("div");
    consentBox.className = "cookie-consent";
    consentBox.hidden = true;
    consentBox.setAttribute("role","dialog");
    consentBox.setAttribute("aria-label","Настройки аналитики");
    consentBox.innerHTML = `<div><strong>Аналитика и cookies</strong><p>Необходимые настройки работают без аналитики. Яндекс Метрика включается только с вашего согласия. <a href="${rootPath}cookies.html">Подробнее</a></p></div><div class="cookie-consent__actions"><button type="button" data-consent="necessary">Только необходимые</button><button type="button" class="primary" data-consent="analytics">Разрешить аналитику</button></div>`;
    document.body.appendChild(consentBox);

    document.querySelectorAll(".cookie-settings").forEach(btn => {
      btn.hidden = false;
      btn.addEventListener("click", openConsent);
    });

    const c = currentConsent();
    if (c === "analytics") loadYandex();
    if (!c) openConsent();

    consentBox.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-consent]");
      if (!btn) return;
      const v = btn.dataset.consent;
      saveConsent(v);
      consentBox.hidden = true;
      if (v === "analytics") loadYandex();
    });
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-goal]");
    if (!el) return;
    if (yandexId && currentConsent() === "analytics" && typeof window.ym === "function") {
      window.ym(Number(yandexId), "reachGoal", el.dataset.goal);
    }
  });

  // Current-section navigation shared by desktop and body-level mobile menu.
  const currentPath = location.pathname.replace(/\/index\.html$/, '/');
  const serviceRoutes = ["commercial-management", "sales-audit", "commercial-analytics", "crm-bitrix24", "sales-team-recruitment", "services", "sales-department-from-scratch", "remote-sales-department", "contact-center-management", "customer-base-reactivation", "sales-call-audit", "sales-data-analysis", "crm-commercial-audit", "sales-kpi-motivation", "sales-team-assessment", "commercial-control"];
  let currentSection = '';
  if (/\/tools\//.test(currentPath)) currentSection = 'tools';
  else if (/\/insights\//.test(currentPath)) currentSection = 'insights';
  else if (/\/industries\//.test(currentPath)) currentSection = 'industries';
  else if (/\/(?:cases\.html|case-[^/]+\.html)$/.test(currentPath)) currentSection = 'cases';
  else if (/\/about\//.test(currentPath)) currentSection = 'about';
  else if (serviceRoutes.some(route => currentPath.endsWith('/' + route + '/'))) currentSection = 'services';
  document.querySelectorAll('.nav [data-nav], .mobile-nav [data-nav]').forEach(link => {
    const active = link.dataset.nav === currentSection;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
})();