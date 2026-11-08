// ASYUT AQAR usage log (for the admin dashboard): page views, listing views and contact
// clicks (call / WhatsApp). No IP address, no exact location, no form contents.
// The region is a coarse guess from the browser time zone. Sent through one narrow RPC;
// if the database update is not applied yet, the first failure switches tracking off.
(() => {
  "use strict";
  const cfg = window.LAYAN_CONFIG || {};
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  if (!base || !key || navigator.doNotTrack === "1" || /admin/.test(location.pathname)) return;
  const OFF = "asyutTrackOff";
  const store = window.sessionStorage;
  try { if (store.getItem(OFF)) return; } catch (_) {}
  let session = "";
  try { session = store.getItem("asyutSession") || ""; if (!session) { session = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2)).slice(0, 36); store.setItem("asyutSession", session); } } catch (_) { session = String(Date.now()); }

  const zone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) { return ""; } })();
  const REGIONS = { "Africa/Cairo": "مصر", "Asia/Riyadh": "السعودية", "Asia/Dubai": "الإمارات", "Asia/Kuwait": "الكويت", "Asia/Qatar": "قطر", "Asia/Bahrain": "البحرين", "Asia/Muscat": "عُمان", "Asia/Amman": "الأردن", "Africa/Tripoli": "ليبيا", "Europe/London": "المملكة المتحدة" };
  const region = REGIONS[zone] || (zone ? zone.split("/").pop().replace(/_/g, " ") : "");
  const device = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "موبايل" : /iPad|Tablet/i.test(navigator.userAgent) ? "تابلت" : "كمبيوتر";
  const page = (location.pathname.replace(/^\//, "") || "index.html").slice(0, 120);
  const listingId = () => {
    const id = Number(window.ASYUT_PROPERTY_ID || new URLSearchParams(location.search).get("id"));
    return /property|ads\//.test(location.pathname) && Number.isFinite(id) && id > 0 ? id : null;
  };
  const token = () => { try { return window.LAYAN_SUPABASE?.getSession?.()?.access_token || key; } catch (_) { return key; } };

  let disabled = false;
  function send(event, extra = {}) {
    if (disabled) return;
    const body = JSON.stringify({ p_event: event, p_session: session, p_page: page, p_listing: extra.listing ?? null, p_target: extra.target ?? null, p_referrer: document.referrer ? new URL(document.referrer).hostname.slice(0, 120) : null, p_device: device, p_region: region || null });
    fetch(base + "/rest/v1/rpc/layan_track_event", { method: "POST", keepalive: true, headers: { apikey: key, Authorization: "Bearer " + token(), "Content-Type": "application/json" }, body })
      .then(r => { if (r.status === 404 || r.status === 400) { disabled = true; try { store.setItem(OFF, "1"); } catch (_) {} } })
      .catch(() => {});
  }
  window.AsyutTrack = send;

  send("page_view");
  if (listingId()) send("listing_view", { listing: listingId() });

  // Contact clicks anywhere on the site (listing pages, advertiser pages, services).
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="tel:"], a[href*="wa.me/"], a[href*="api.whatsapp.com"]');
    if (!link) return;
    if (/201007044265/.test(link.href)) return; // the admin's own WhatsApp is not a listing contact
    const card = link.closest("[data-property-id], [id^='marketplace-listing-'], .mk-card");
    const title = (card?.querySelector("h1, h2, h3")?.textContent || document.querySelector("h1")?.textContent || "").trim().slice(0, 140);
    send(/^tel:/.test(link.href) ? "contact_call" : "contact_whatsapp", { listing: listingId(), target: title || null });
  }, true);
  document.addEventListener("click", event => {
    if (event.target.closest("[data-favorite-id]")) send("favorite", { listing: Number(event.target.closest("[data-favorite-id]").dataset.favoriteId) || null });
    if (event.target.closest("#addOfferTop, [data-open-add-offer]")) send("add_listing_open");
  }, true);
  window.addEventListener("layan-auth-state-changed", e => { if (e.detail?.authenticated) send("login"); });
})();
