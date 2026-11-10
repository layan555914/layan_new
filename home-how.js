// ASYUT AQAR home — «كيف تعمل المنصة؟»: switch between the buyer and the advertiser journey (2026-11-10).
(function () {
  "use strict";
  const tabs = Array.from(document.querySelectorAll('.hw-tabs [role="tab"]'));
  if (!tabs.length) return;
  function select(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle("is-active", on);
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", e => {
      // RTL: the right arrow moves to the previous tab, the left arrow to the next one.
      const step = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      select(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });
})();
