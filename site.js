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
    document.querySelector(".header")?.appendChild(mobileNav);

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
})();