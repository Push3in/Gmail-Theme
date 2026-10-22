// Simple Gmail — content script.
// CSS does most of the work; this script toggles feature classes on <html>,
// tags parts of Gmail that have no stable selector, adds date-group labels
// and the floating compose button.
(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    dark: "off", // "off" | "on" | "system"
    hideSidePanels: true,
    dateGroups: true,
    floatingCompose: true,
    quietToolbar: false,
    quietControls: false,
    width: "normal", // "narrow" | "normal" | "wide"
    rowSpace: "comfy", // "tight" | "comfy" | "roomy"
  };
  const WIDTHS = { narrow: "960px", normal: "1200px", wide: "1440px" };
  // Added above and below each row, on top of Gmail's own row height
  // (so each row grows by twice this).
  const ROW_SPACE = { tight: "0px", comfy: "3px", roomy: "5px" };

  const root = document.documentElement;
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  let settings = { ...DEFAULTS };

  // Apply the default immediately so Gmail doesn't flash its busy layout.
  root.classList.add("sg-on");

  // ---------- settings -> classes ----------

  function applySettings() {
    const on = settings.enabled;
    const dark =
      settings.dark === "on" || (settings.dark === "system" && darkQuery.matches);
    root.classList.toggle("sg-on", on);
    root.classList.toggle("sg-dark", on && dark);
    root.classList.toggle("sg-hide-panels", on && settings.hideSidePanels);
    root.classList.toggle("sg-groups", on && settings.dateGroups);
    root.classList.toggle("sg-fab-on", on && settings.floatingCompose);
    root.classList.toggle("sg-quiet-toolbar", on && settings.quietToolbar);
    root.classList.toggle("sg-quiet-controls", on && settings.quietControls);
    root.style.setProperty("--sg-width", WIDTHS[settings.width] || WIDTHS.normal);
    root.style.setProperty("--sg-row-space", ROW_SPACE[settings.rowSpace] || ROW_SPACE.comfy);
    if (!on) closeNav();
    scheduleScan();
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    applySettings();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
    applySettings();
  });

  darkQuery.addEventListener("change", applySettings);

  // ---------- view state ----------

  // Thread URLs end in a long opaque id: #inbox/FMfcgz…, #label/Work/FMfcgz…
  function isThreadView() {
    const parts = location.hash.slice(1).split("/");
    return parts.length > 1 && /^[A-Za-z0-9]{16,}$/.test(parts[parts.length - 1]);
  }

  function updateViewClasses() {
    root.classList.toggle("sg-thread-view", isThreadView());
    root.classList.toggle(
      "sg-has-selection",
      !!document.querySelector('div[role="main"] tr.zA [role="checkbox"][aria-checked="true"]')
    );
  }

  window.addEventListener("hashchange", () => {
    closeNav();
    scheduleScan();
  });

  // ---------- tagging things without stable selectors ----------

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute("data-sg-hide", "");
    else el.removeAttribute("data-sg-hide");
  }

  // The Terms / Privacy / storage footer: hide the largest ancestor of the
  // policy link that doesn't also contain mail content.
  function tagFooter() {
    for (const link of document.querySelectorAll('div[role="main"] a[href*="/policies/terms"]')) {
      let el = link;
      while (
        el.parentElement &&
        el.parentElement.getAttribute("role") !== "main" &&
        !el.parentElement.querySelector('tr.zA, [role="listitem"], table.Bs, [role="tablist"], .G-atb')
      ) {
        el = el.parentElement;
      }
      setHidden(el, settings.enabled);
    }
  }

  // Gmail's Compose button; older Gmail versions mark it with gh="cm".
  const COMPOSE_SELECTOR = '[gh="cm"], .T-I.T-I-KE.L3';

  // Fallback for Gmail versions without .aqn: the folders/labels sidebar is
  // the widest ancestor of Compose that is still a narrow column.
  function tagNav() {
    if (document.querySelector(".aqn")) return;
    const compose = document.querySelector(COMPOSE_SELECTOR);
    if (!compose) return;
    const tagged = document.querySelector("[data-sg-nav]");
    if (tagged && tagged.contains(compose)) return;
    if (tagged) tagged.removeAttribute("data-sg-nav");
    let el = compose;
    while (el.parentElement && el.parentElement !== document.body) {
      const width = el.parentElement.getBoundingClientRect().width;
      if (width > 400 || el.parentElement.querySelector('div[role="main"]')) break;
      el = el.parentElement;
    }
    if (el !== compose) el.setAttribute("data-sg-nav", "");
  }

  // Gmail themes can be light or dark; read it from the mail text colour.
  function detectGmailTheme() {
    const sample = document.querySelector('div[role="main"]') || document.body;
    const [r, g, b] = getComputedStyle(sample).color.match(/\d+/g).map(Number);
    root.classList.toggle("sg-gmail-dark", (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5);
  }

  function setVar(name, value) {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  }

  // Centre the search bar on the window: adjust its left margin by however
  // far it currently sits from the middle. Also hand its position to the
  // search options panel, which Gmail places at the page level from its own
  // default layout rather than from the bar.
  function placeSearch() {
    const header = document.querySelector("header");
    const form = header && header.querySelector('form[role="search"]');
    if (!form) return;
    const box = form.getBoundingClientRect();
    const target = (document.documentElement.clientWidth - box.width) / 2;
    const margin = parseFloat(getComputedStyle(form).marginLeft) || 0;
    const left = Math.max(0, Math.round(margin + target - box.left));
    setVar("--sg-search-left", `${left}px`);
    setVar("--sg-search-x", `${Math.round(box.left + left - margin)}px`);
    setVar("--sg-search-w", `${Math.round(box.width)}px`);
    // The slide-over menu opens just below the header.
    setVar("--sg-header-bottom", `${Math.round(header.getBoundingClientRect().bottom)}px`);
  }

  // The narrow Mail / Chat / Meet app rail on the far left.
  function tagAppRail() {
    for (const nav of document.querySelectorAll('[role="navigation"]')) {
      if (nav.closest(".aqn, [data-sg-nav]")) continue;
      const rect = nav.getBoundingClientRect();
      if (rect.width > 0 && rect.width < 100 && rect.left < 100) {
        setHidden(nav, settings.enabled && settings.hideSidePanels);
      }
    }
  }

  // ---------- toolbar matches the content below it ----------

  function isVisible(el) {
    return el.getBoundingClientRect().width > 0;
  }

  function hasBackground(el) {
    return !/^(transparent|rgba\(.*,\s*0\))$/.test(getComputedStyle(el).backgroundColor);
  }

  // Things every open thread contains: subject heading, message blocks.
  const THREAD_ANCHORS = 'h2.hP, div.adn, [role="listitem"], table.Bs';

  // The mail card: the outermost painted box around the open thread inside
  // Gmail's main region, or the region itself when nothing is painted.
  function mailCard() {
    const anchor = [...document.querySelectorAll(`div[role="main"] :is(${THREAD_ANCHORS})`)].find(isVisible);
    if (!anchor) return null;
    const main = anchor.closest('div[role="main"]');
    let card = null;
    for (let el = anchor.parentElement; el && el !== main; el = el.parentElement) {
      if (hasBackground(el)) card = el;
    }
    return card || main;
  }

  // In a list view: Gmail's main region holding the visible conversation rows.
  function listBox() {
    const row = [...document.querySelectorAll('div[role="main"] tr.zA')].find(isVisible);
    return row ? row.closest('div[role="main"]') : null;
  }

  const TOOLBAR_PROPS = ["margin-left", "margin-right", "width", "max-width"];

  function alignToolbar() {
    const bar = [...document.querySelectorAll(".G-atb")].find(isVisible);
    const card = settings.enabled ? (isThreadView() ? mailCard() : listBox()) : null;
    for (const other of document.querySelectorAll(".G-atb")) {
      if (other === bar && card) continue;
      for (const prop of TOOLBAR_PROPS) other.style.removeProperty(prop);
    }
    if (!bar || !card || !bar.parentElement) return;
    const box = card.getBoundingClientRect();
    const parent = bar.parentElement.getBoundingClientRect();
    const set = (prop, value) => {
      if (bar.style.getPropertyValue(prop) !== value) bar.style.setProperty(prop, value, "important");
    };
    set("margin-left", `${Math.round(box.left - parent.left)}px`);
    set("margin-right", "0px");
    set("width", `${Math.round(box.width)}px`);
    set("max-width", "none");
  }

  window.addEventListener("resize", () => scheduleScan());

  // ---------- date groups (Today / Yesterday / Last month …) ----------

  const MONTH = new Intl.DateTimeFormat(undefined, { month: "long" });
  const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function groupLabel(date, now) {
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 864e5);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return "This week";
    const monthsAgo =
      (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
    if (monthsAgo === 0) return "Earlier this month";
    if (monthsAgo === 1) return "Last month";
    if (date.getFullYear() === now.getFullYear()) return MONTH.format(date);
    return MONTH_YEAR.format(date);
  }

  // Gmail puts the full timestamp in the title of the date cell.
  function rowDate(row) {
    const span = row.querySelector("td.xW span[title], td:last-child span[title]");
    if (!span) return null;
    const date = new Date(span.getAttribute("title").replace(/\s+/g, " "));
    return isNaN(date) ? null : date;
  }

  function labelRows() {
    const enabled = settings.enabled && settings.dateGroups;
    const now = new Date();
    const bodies = new Set();
    for (const row of document.querySelectorAll('div[role="main"] tr.zA')) {
      bodies.add(row.parentElement);
    }
    for (const body of bodies) {
      let previous = null;
      let first = true;
      for (const row of body.querySelectorAll(":scope > tr.zA")) {
        const date = enabled ? rowDate(row) : null;
        const label = date ? groupLabel(date, now) : null;
        // No header above the very first group when it's "Today" (cleaner top).
        const show = label && label !== previous && !(first && label === "Today");
        if (label) {
          previous = label;
          first = false;
        }
        // The label is drawn by CSS from this attribute. Never insert rows:
        // Gmail maps a clicked row to a conversation by its position, so an
        // extra row above it opened the conversation below.
        if (show) {
          if (row.getAttribute("data-sg-group") !== label) row.setAttribute("data-sg-group", label);
        } else if (row.hasAttribute("data-sg-group")) {
          row.removeAttribute("data-sg-group");
        }
      }
    }
    // Rows from a previous scan that turned the feature off or left the list.
    if (!enabled) {
      for (const row of document.querySelectorAll("tr[data-sg-group]")) {
        row.removeAttribute("data-sg-group");
      }
    }
  }

  // ---------- slide-over navigation (hamburger) ----------

  const MENU_SELECTOR = 'header [aria-label="Main menu"], header [role="button"][aria-expanded]';

  function menuButton() {
    return document.querySelector(MENU_SELECTOR);
  }

  function closeNav() {
    root.classList.remove("sg-nav-open");
  }

  function onMenuEvent(event) {
    if (!settings.enabled) return;
    const btn = menuButton();
    const nav = [...document.querySelectorAll(".aqn, [data-sg-nav]")].find(
      (el) => el.getBoundingClientRect().width > 0
    );
    if (btn && btn.contains(event.target)) {
      event.stopPropagation();
      event.preventDefault();
      if (event.type === "click") root.classList.toggle("sg-nav-open");
      return;
    }
    if (event.type !== "click" || !root.classList.contains("sg-nav-open")) return;
    // Close after choosing a folder/label, or when clicking outside the panel.
    if (!nav || !nav.contains(event.target) || event.target.closest("a")) {
      setTimeout(closeNav, 0);
    }
  }

  document.addEventListener("mousedown", onMenuEvent, true);
  document.addEventListener("click", onMenuEvent, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  // ---------- floating compose button ----------

  const FAB_SVG = `
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path d="M11 3h2v8h-2z" fill="#ea4335"/>
      <path d="M13 11h8v2h-8z" fill="#4285f4"/>
      <path d="M11 13h2v8h-2z" fill="#34a853"/>
      <path d="M3 11h8v2H3z" fill="#fbbc04"/>
      <path d="M11 11h2v2h-2z" fill="#5f6368"/>
    </svg>`;

  // Gmail's own Compose button reacts to mouse events, not plain clicks.
  function openCompose() {
    const compose = document.querySelector(COMPOSE_SELECTOR);
    if (!compose) return;
    for (const type of ["mousedown", "mouseup", "click"]) {
      compose.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function ensureFab() {
    if (document.getElementById("sg-compose") || !document.body) return;
    const fab = document.createElement("button");
    fab.id = "sg-compose";
    fab.type = "button";
    fab.title = "Compose";
    fab.setAttribute("aria-label", "Compose");
    fab.innerHTML = FAB_SVG;
    fab.addEventListener("click", openCompose);
    document.body.appendChild(fab);
  }

  // ---------- scan loop ----------

  // Runs right before the next paint, so Gmail's unstyled layout (sidebar,
  // full-width toolbar, rows without date labels) never reaches the screen.
  let scanFrame = 0;
  function scheduleScan() {
    if (scanFrame) return;
    scanFrame = requestAnimationFrame(() => {
      scanFrame = 0;
      ensureFab();
      updateViewClasses();
      detectGmailTheme();
      placeSearch();
      tagNav();
      tagFooter();
      tagAppRail();
      labelRows();
      alignToolbar();
    });
  }

  // Changes that can't affect anything we tag, skipped because a rescan reads
  // layout right before the next paint:
  //  - inside a row: Gmail inserts the archive/delete/snooze icons on every
  //    hover (rescanning made hovering stutter);
  //  - inside the search bar or a page-level popup (search options): the
  //    suggestions dropdown rebuilds on open and on every keystroke, and
  //    rescanning delayed it from appearing.
  const IGNORED_SUBTREES = 'tr.zA, header form[role="search"], .ZF-Av';

  function isIgnorable(record) {
    const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
    return record.type === "childList" && !!target && !!target.closest(IGNORED_SUBTREES);
  }

  const observer = new MutationObserver((records) => {
    if (records.some((record) => !isIgnorable(record))) scheduleScan();
  });
  function start() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-checked"],
    });
    scheduleScan();
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
