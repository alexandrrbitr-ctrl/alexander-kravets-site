(() => {
  "use strict";

  // Measure fixed UI so content and anchor targets remain accessible after resizing.
  const layoutHeader = document.querySelector(".header");
  const layoutCta = document.querySelector(".mobile-cta");
  const syncLayout = () => {
    const height = layoutHeader?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty("--header-height", `${height}px`);
    const fixed = layoutHeader && getComputedStyle(layoutHeader).position === "fixed";
    document.documentElement.style.setProperty("--header-flow-offset", `${fixed ? height : 0}px`);
    const cta = document.querySelector(".mobile-cta");
    const fixedCta = cta && getComputedStyle(cta).position === "fixed";
    const ctaHeight = fixedCta ? cta.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--mobile-cta-space", `${ctaHeight ? ctaHeight + 28 : 0}px`);
    const openMenu = document.querySelector(".mobile-nav:not([hidden])");
    if (openMenu) openMenu.style.top = `${height}px`;
  };
  syncLayout();
  window.addEventListener("resize", syncLayout);
  if ("ResizeObserver" in window) {
    const layoutObserver = new ResizeObserver(syncLayout);
    if (layoutHeader) layoutObserver.observe(layoutHeader);
    const observeCta = () => {
      const cta = document.querySelector(".mobile-cta");
      if (cta) layoutObserver.observe(cta);
      syncLayout();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeCta, { once: true });
    else observeCta();
  }

  // Keep mobile messenger actions in normal flow, after the opening content.
  // With JavaScript disabled the same non-fixed panel remains at the page end.
  const placeMobileContacts = () => {
    const panel = document.querySelector(".mobile-cta");
    const opening = document.querySelector("main > section .shell");
    if (!panel || !opening || !document.body.classList.contains("fr-premium")) return;
    const metrics = Array.from(opening.children).find((child) =>
      child.classList.contains("fr-metrics") || child.classList.contains("proof-line"));
    opening.insertBefore(panel, metrics || null);
    panel.dataset.placement = "flow";
    syncLayout();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", placeMobileContacts, { once: true });
  } else placeMobileContacts();

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


  // A non-modal, in-flow dialog reserves space instead of covering page content.
  // Links remain usable without JavaScript, including "open in a new tab".
  let contactDock = null;
  let contactDialog = null;
  let contactTrigger = null;
  const closeContacts = (restoreFocus = true) => {
    if (!contactDialog?.open) return;
    contactDialog.close();
    contactDock.hidden = true;
    document.querySelectorAll("[data-contact-chooser]").forEach((el) => el.setAttribute("aria-expanded", "false"));
    if (restoreFocus) {
      const target = contactTrigger?.getClientRects().length ? contactTrigger : toggle;
      target?.focus({ preventScroll: true });
      // Closing a dock above the viewport can move its trigger out of view.
      const rect = target?.getBoundingClientRect();
      const headerBottom = layoutHeader?.getBoundingClientRect().bottom || 0;
      if (rect && (rect.top < headerBottom || rect.bottom > innerHeight)) {
        target.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
  };
  const createContactDialog = () => {
    if (contactDialog) return;
    contactDock = document.createElement("div");
    contactDock.className = "fr-contact-dock";
    contactDock.hidden = true;
    contactDock.innerHTML = `<div class="fr-contact-dock__inner"><dialog class="fr-contact-dialog" id="contact-chooser" aria-labelledby="contact-chooser-title" aria-describedby="contact-chooser-description">
      <div class="fr-contact-dialog__heading"><div><p class="fr-contact-dialog__eyebrow">Личная связь</p><h2 id="contact-chooser-title">Обсудить задачу</h2></div><button class="fr-contact-dialog__close" type="button" aria-label="Закрыть выбор мессенджера">×</button></div>
      <p id="contact-chooser-description">Выберите, где удобнее написать мне.</p>
      <div class="fr-contact-dialog__chats">
        <a class="fr-messenger" href="${personalTelegramUrl}" target="_blank" rel="noopener noreferrer" data-goal="telegram_contact"><img src="${new URL("messenger-telegram.svg", contactAssets)}" width="32" height="32" alt=""/><span><strong>Telegram</strong><small>Личные сообщения · @Alekdvv</small></span><span aria-hidden="true">↗</span></a>
        <a class="fr-messenger" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" data-goal="whatsapp_contact"><img src="${new URL("messenger-whatsapp.svg", contactAssets)}" width="32" height="32" alt=""/><span><strong>WhatsApp</strong><small>Личные сообщения</small></span><span aria-hidden="true">↗</span></a>
      </div>
      <div class="fr-contact-dialog__channel"><p class="fr-contact-dialog__eyebrow">Материалы и новости</p>
        <a class="fr-messenger fr-messenger--channel" href="${maxChannelUrl}" target="_blank" rel="noopener noreferrer" data-max-channel><img src="${new URL("messenger-max.svg", contactAssets)}" width="30" height="30" alt=""/><span><strong>MAX</strong><small>Канал «Формула роста»</small></span><span aria-hidden="true">↗</span></a>
        <span data-max-direct-slot hidden></span><p class="fr-contact-dialog__note">Личный чат MAX пока недоступен.</p>
      </div>
    </dialog></div>`;
    contactDialog = contactDock.querySelector("dialog");
    contactDock.querySelector("button").addEventListener("click", () => closeContacts());
    contactDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeContacts(); });
    contactDialog.addEventListener("click", (event) => {
      if (event.target.closest("a")) setTimeout(() => closeContacts(), 0);
    });
  };
  const openContacts = (trigger) => {
    if (contactDialog?.open && contactTrigger === trigger) { closeContacts(); return; }
    closeContacts(false);
    createContactDialog();
    contactTrigger = trigger;
    const inHeader = !!trigger.closest(".header, .mobile-nav");
    const actions = trigger.closest(".hero__actions, .contact__actions");
    const section = trigger.closest("main section");
    const standalone = inHeader || !actions;
    contactDock.classList.toggle("fr-contact-dock--standalone", standalone);
    contactDock.classList.toggle("fr-contact-dock--header", inHeader);
    if (inHeader) layoutHeader.after(contactDock);
    else if (actions?.classList.contains("contact__actions")) actions.appendChild(contactDock);
    else if (actions) actions.after(contactDock);
    else (section || document.querySelector("main") || layoutHeader).after(contactDock);
    contactDock.hidden = false;
    populateMaxDirectSlots();
    contactDialog.show();
    trigger.setAttribute("aria-expanded", "true");
    contactDialog.querySelector(".fr-messenger").focus({ preventScroll: true });
    contactDialog.scrollIntoView({ block: "nearest", behavior: "instant" });
  };
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-contact-chooser]");
    if (trigger && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      openContacts(trigger);
    } else if (event.target.closest(".menu-toggle")) closeContacts(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && contactDialog?.open) {
      event.preventDefault(); closeContacts();
    } else if (event.key === " " && event.target.matches("[data-contact-chooser]")) {
      event.preventDefault(); event.target.click();
    }
  });

  // Keep aria-controls valid before the first activation, without displaying a window.
  createContactDialog();
  document.body.appendChild(contactDock);

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
  const cfg = window.KRAVETS_ANALYTICS || {};
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
  if (/\/insights\//.test(currentPath)) currentSection = 'insights';
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