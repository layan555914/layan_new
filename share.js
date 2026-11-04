(() => {
  "use strict";

  const cleanShareUrl = (value) => {
    const url = new URL(String(value || window.location.href), window.location.href);
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  };

  const getTitle = (element) => {
    const heading = element?.querySelector("h1, h2, h3, .company-directory-card h3");
    return (heading?.textContent || document.title || "أسيوط عقار").trim();
  };

  async function share(title, url) {
    const cleanUrl = cleanShareUrl(url);
    const data = { title: title + " | أسيوط عقار", text: title + " عبر منصة أسيوط عقار", url: cleanUrl };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(cleanUrl);
      announce("تم نسخ الرابط النظيف للمشاركة.");
    } catch (_) {
      window.prompt("انسخ الرابط للمشاركة:", cleanUrl);
    }
  }

  function announce(message) {
    let status = document.getElementById("asyutShareStatus");
    if (!status) {
      status = document.createElement("div");
      status.id = "asyutShareStatus";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.hidden = false;
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => { status.hidden = true; }, 2600);
  }

  function addPageShare() {
    if (document.getElementById("asyutPageShare") || document.body.dataset.shareDisabled === "true") return;
    const button = document.createElement("button");
    button.id = "asyutPageShare";
    button.type = "button";
    button.className = "asyut-share-button";
    button.textContent = "مشاركة الصفحة";
    button.setAttribute("aria-label", "مشاركة هذه الصفحة");
    button.addEventListener("click", () => share(getTitle(document.querySelector("main") || document.body), window.location.href));
    document.body.appendChild(button);
  }

  function addItemShares(root = document) {
    const selectors = [
      ".company-directory-card",
      ".offer-card",
      ".directory-card",
      ".marketplace-listing-card",
      ".listing-card"
    ];
    root.querySelectorAll(selectors.join(",")).forEach((card) => {
      if (card.querySelector(":scope > .asyut-item-share")) return;
      const link = card.querySelector('a[href*="property.html"], a[href*="company.html"], a[data-share-url]');
      const url = card.dataset.shareUrl || link?.dataset.shareUrl || link?.href;
      if (!url) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "asyut-item-share";
      button.textContent = "مشاركة";
      button.setAttribute("aria-label", "مشاركة " + getTitle(card));
      button.addEventListener("click", () => share(getTitle(card), url));
      card.appendChild(button);
    });
  }

  function installStyles() {
    if (document.getElementById("asyutShareStyles")) return;
    const style = document.createElement("style");
    style.id = "asyutShareStyles";
    style.textContent = `
      .asyut-share-button,.asyut-item-share{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:9px 15px;border:1px solid #c8963e;border-radius:10px;background:#102746;color:#fff;font:700 14px Tahoma,Arial,sans-serif;cursor:pointer;touch-action:manipulation}
      .asyut-share-button{position:fixed;z-index:40;left:16px;bottom:16px;box-shadow:0 5px 18px #10274635}
      .asyut-item-share{margin:10px 12px 12px}
      .asyut-category-share-wrap{display:grid;grid-template-rows:1fr auto;gap:6px;min-width:0}
      .asyut-category-share-wrap>.category-tile{width:100%;height:100%}
      .asyut-category-share{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:7px 12px;border:1px solid #c8963e;border-radius:9px;background:#fff;color:#102746;font:700 13px Tahoma,Arial,sans-serif;cursor:pointer;touch-action:manipulation}
      .company-directory-card,.offer-card,.directory-card,.marketplace-listing-card,.listing-card{position:relative}
      #asyutShareStatus{position:fixed;z-index:100;right:50%;bottom:72px;transform:translateX(50%);max-width:calc(100% - 24px);padding:10px 16px;border-radius:9px;background:#102746;color:#fff;font:14px Tahoma,Arial,sans-serif;box-shadow:0 5px 18px #10274635}
      #asyutShareStatus[hidden]{display:none}
      @media(max-width:600px){.asyut-share-button{left:12px;bottom:12px;min-height:46px}.asyut-item-share{width:calc(100% - 24px);margin:8px 12px 12px}}
    `;
    document.head.appendChild(style);
  }

  function addCategoryShares(root = document) {
    const tiles = [];
    if (root.matches?.(".category-grid .category-tile[data-market-category]")) tiles.push(root);
    tiles.push(...root.querySelectorAll(".category-grid .category-tile[data-market-category]"));
    tiles.forEach((tile) => {
      if (tile.parentElement?.classList.contains("asyut-category-share-wrap")) return;
      const category = tile.dataset.marketCategory;
      if (!category) return;
      const wrapper = document.createElement("div");
      wrapper.className = "asyut-category-share-wrap";
      tile.parentNode.insertBefore(wrapper, tile);
      wrapper.appendChild(tile);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "asyut-category-share";
      button.textContent = "مشاركة القسم";
      button.setAttribute("aria-label", "مشاركة قسم " + category);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const url = new URL(window.location.href);
        url.searchParams.set("category", category);
        url.hash = "";
        share(category, url.href);
      });
      wrapper.appendChild(button);
    });
  }

  function init() {
    installStyles();
    addPageShare();
    addItemShares();
    addCategoryShares();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          const root = node.matches?.("article") ? node.parentElement || document : node;
          addItemShares(root);
          addCategoryShares(root);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();