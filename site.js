(() => {
  "use strict";

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
    mobileNav.innerHTML = `<div class="mobile-nav__inner">${desktopNav.innerHTML}<a class="mobile-nav__contact" href="https://t.me/formularosta_pro" target="_blank" rel="noopener noreferrer" data-goal="telegram_contact">Обсудить задачу ↗</a></div>`;
    document.body.appendChild(mobileNav);

    const setMenu = (open) => {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
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

  // V17: active navigation on pages, section anchors and mobile menu.
  const navLinks = [...document.querySelectorAll('.nav a, .mobile-nav__inner > a')]
    .filter(a => !a.classList.contains('mobile-nav__contact'));
  const path = location.pathname.replace(/\/index\.html$/, '/');
  const isHome = /\/alexander-kravets-site\/$/.test(path) || path === '/';
  const inInsights = /\/insights\//.test(path);
  const inCases = /\/(?:cases\.html|case-[^/]+\.html)$/.test(path);
  const inMedicine = /\/industries\/medicine-pharma\//.test(path);
  const inServices = /\/(?:commercial-management|commercial-analytics|sales-audit|crm-bitrix24|sales-team-recruitment)\//.test(path);

  const markActive = (key) => {
    navLinks.forEach((a) => {
      let value = '';
      try {
        const url = new URL(a.getAttribute('href'), location.href);
        if (key === 'insights' && /\/insights\//.test(url.pathname)) value = 'yes';
        else if (key === 'medicine' && /\/industries\/medicine-pharma\//.test(url.pathname)) value = 'yes';
        else if (key === 'cases' && (url.hash === '#cases' || /\/cases\.html$/.test(url.pathname))) value = 'yes';
        else if (key === 'services' && url.hash === '#services') value = 'yes';
        else if (key === 'system' && url.hash === '#system') value = 'yes';
        else if (key === 'about' && url.hash === '#about') value = 'yes';
      } catch (_) { /* Invalid href should not break navigation. */ }
      if (value) a.setAttribute('aria-current', isHome ? 'location' : 'page');
      else a.removeAttribute('aria-current');
    });
  };
  if (inInsights) markActive('insights');
  else if (inCases) markActive('cases');
  else if (inMedicine) markActive('medicine');
  else if (inServices) markActive('services');
  else if (isHome) {
    const sectionKeys = ['cases', 'system', 'services', 'about'];
    const syncHash = () => {
      const key = location.hash.substring(1);
      markActive(sectionKeys.includes(key) ? key : '');
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    navLinks.forEach(a => a.addEventListener('click', () => {
      const key = (a.hash || '').slice(1);
      if (sectionKeys.includes(key)) markActive(key);
    }));
    // Recalculate from current positions so leaving a section clears stale state.
    const trackedSections = sectionKeys.map(k => document.getElementById(k)).filter(Boolean);
    let navFrame = null;
    const syncScroll = () => {
      if (navFrame !== null) return;
      navFrame = window.requestAnimationFrame(() => {
        navFrame = null;
        const headerBottom = document.querySelector('.header')?.getBoundingClientRect().bottom || 0;
        const current = trackedSections.find(el => {
          const rect = el.getBoundingClientRect();
          return rect.top <= window.innerHeight * .4 && rect.bottom > headerBottom + 1;
        });
        markActive(current?.id || '');
      });
    };
    window.addEventListener('scroll', syncScroll, { passive: true });
    window.addEventListener('resize', syncScroll);
  }
})();