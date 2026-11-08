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
  const country = REGIONS[zone] || (zone ? zone.split("/").pop().replace(/_/g, " ") : "");
  // Governorate / center: what the visitor chose (one tap in the mascot welcome), e.g.
  // "أسيوط · أبنوب" or "القاهرة". Otherwise the country, with "غير محدد" for Egypt.
  const local = key => { try { return localStorage.getItem(key) || ""; } catch (_) { return ""; } };
  const regionNow = () => {
    const home = local("asyutHomeArea");           // chosen by the visitor or from GPS (precise)
    if (home) return home.slice(0, 80);
    const ip = local("asyutIpArea");               // from the internet connection (approximate)
    if (ip) return (ip + " (تقريبي)").slice(0, 80);
    return country === "مصر" ? "مصر · غير محدد" : country;
  };

  // ---- Where the visitor is ----
  // Places used to name a position: Assiut centers, Egyptian governorates, Gulf cities.
  const CENTERS = [["مدينة أسيوط", 27.180, 31.183], ["أسيوط الجديدة", 27.220, 31.330], ["ديروط", 27.556, 30.808], ["القوصية", 27.440, 30.818], ["منفلوط", 27.310, 30.970], ["أبنوب", 27.268, 31.151], ["الفتح", 27.196, 31.262], ["أبو تيج", 27.044, 31.320], ["ساحل سليم", 27.050, 31.395], ["البداري", 26.993, 31.415], ["صدفا", 26.960, 31.375], ["الغنايم", 26.905, 31.330]];
  const PLACES = [["القاهرة", 30.044, 31.236], ["الجيزة", 30.013, 31.209], ["الإسكندرية", 31.200, 29.918], ["سوهاج", 26.557, 31.695], ["المنيا", 28.110, 30.750], ["قنا", 26.164, 32.727], ["الأقصر", 25.687, 32.640], ["أسوان", 24.089, 32.899], ["بني سويف", 29.074, 31.097], ["الفيوم", 29.308, 30.842], ["الوادي الجديد", 25.451, 30.546], ["البحر الأحمر", 27.257, 33.811], ["القليوبية", 30.460, 31.184], ["الشرقية", 30.587, 31.502], ["الدقهلية", 31.040, 31.378], ["الغربية", 30.786, 31.000], ["المنوفية", 30.552, 31.009], ["البحيرة", 31.034, 30.468], ["كفر الشيخ", 31.111, 30.940], ["دمياط", 31.417, 31.814], ["بورسعيد", 31.265, 32.302], ["الإسماعيلية", 30.604, 32.272], ["السويس", 29.966, 32.549], ["شمال سيناء", 31.131, 33.798], ["جنوب سيناء", 27.915, 34.330], ["مطروح", 31.354, 27.237],
    ["الإمارات · أبوظبي", 24.453, 54.377], ["الإمارات · دبي", 25.204, 55.270], ["الإمارات · الشارقة", 25.346, 55.420], ["الإمارات · عجمان", 25.405, 55.513], ["الإمارات · العين", 24.207, 55.744], ["الإمارات · رأس الخيمة", 25.789, 55.943], ["الإمارات · الفجيرة", 25.128, 56.326],
    ["السعودية · الرياض", 24.713, 46.675], ["السعودية · جدة", 21.485, 39.193], ["السعودية · مكة", 21.389, 39.858], ["السعودية · الدمام", 26.420, 50.089], ["الكويت", 29.376, 47.977], ["قطر · الدوحة", 25.285, 51.531], ["عُمان · مسقط", 23.588, 58.383], ["البحرين · المنامة", 26.228, 50.586], ["الأردن · عمّان", 31.954, 35.911]];
  const km = (a, b, c, d) => { const r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * 6371; };
  const nearest = (lat, lon, list) => list.reduce((best, p) => { const d = km(lat, lon, p[1], p[2]); return d < best.d ? { name: p[0], d } : best; }, { name: "", d: Infinity });
  function placeOf(lat, lon) {
    if (lat > 26.70 && lat < 27.80 && lon > 30.45 && lon < 31.85) return "أسيوط · " + nearest(lat, lon, CENTERS).name;
    const p = nearest(lat, lon, PLACES);
    return p.d < 250 ? p.name : "";
  }
  // Precise location: only when the visitor taps «حدد موقعي» and allows it. Stores the nearest
  // center/governorate name only (never coordinates).
  window.AsyutLocate = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(pos => {
      const name = placeOf(pos.coords.latitude, pos.coords.longitude) || country;
      try { localStorage.setItem("asyutHomeArea", name); localStorage.setItem("asyutHomeAreaSource", "gps"); } catch (_) {}
      window.dispatchEvent(new CustomEvent("asyut:home-area", { detail: name }));
      resolve(name);
    }, reject, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });
  // Approximate location from the internet connection, once a week per visitor. Only the city
  // name is kept. Phone networks in Egypt often appear as Cairo, so the visitor's own choice wins.
  const IP_CITY = { "Asyut": "أسيوط", "Assiut": "أسيوط", "Cairo": "القاهرة", "Giza": "الجيزة", "Alexandria": "الإسكندرية", "Sohag": "سوهاج", "Minya": "المنيا", "Al Minya": "المنيا", "Qena": "قنا", "Luxor": "الأقصر", "Aswan": "أسوان", "Abu Dhabi": "الإمارات · أبوظبي", "Dubai": "الإمارات · دبي", "Sharjah": "الإمارات · الشارقة", "Ajman": "الإمارات · عجمان", "Al Ain": "الإمارات · العين", "Riyadh": "السعودية · الرياض", "Jeddah": "السعودية · جدة", "Kuwait City": "الكويت", "Doha": "قطر · الدوحة", "Muscat": "عُمان · مسقط", "Manama": "البحرين · المنامة" };
  (async () => {
    if (local("asyutHomeArea")) return;
    const checked = Number(local("asyutIpAreaAt")) || 0;
    if (local("asyutIpArea") && Date.now() - checked < 7 * 864e5) return;
    try {
      const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      let name = "";
      if (typeof j.latitude === "number" && typeof j.longitude === "number") name = placeOf(j.latitude, j.longitude);
      if (!name) name = IP_CITY[j.city] || IP_CITY[j.region] || [j.country_name, j.city].filter(Boolean).join(" · ");
      if (name) { localStorage.setItem("asyutIpArea", name.slice(0, 60)); localStorage.setItem("asyutIpAreaAt", String(Date.now())); }
    } catch (_) {}
  })();
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
    const body = JSON.stringify({ p_event: event, p_session: session, p_page: page, p_listing: extra.listing ?? null, p_target: extra.target ?? null, p_referrer: document.referrer && new URL(document.referrer).hostname !== location.hostname ? new URL(document.referrer).hostname.slice(0, 120) : null, p_device: device, p_region: regionNow() || null });
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
    const card = link.closest("[data-listing-id], [data-property-id], [id^='marketplace-listing-'], .mk-card, .company-card");
    const title = (card?.querySelector("h1, h2, h3")?.textContent || document.querySelector("h1")?.textContent || "").trim().slice(0, 120);
    const cardId = Number(card?.dataset.listingId || card?.dataset.propertyId);
    const kind = card?.matches(".mk-card, [id^='marketplace-listing-']") ? "خدمة: " : card?.matches(".company-card") || /company/.test(location.pathname) ? "شركة: " : "";
    send(/^tel:/.test(link.href) ? "contact_call" : "contact_whatsapp", { listing: Number.isFinite(cardId) && cardId > 0 ? cardId : listingId(), target: title ? kind + title : null });
  }, true);
  document.addEventListener("click", event => {
    if (event.target.closest("[data-favorite-id]")) send("favorite", { listing: Number(event.target.closest("[data-favorite-id]").dataset.favoriteId) || null });
    if (event.target.closest("#addOfferTop, [data-open-add-offer]")) send("add_listing_open");
  }, true);
  // Which centers people look at: city filters on listing pages ("search" events).
  document.addEventListener("change", event => {
    const el = event.target;
    if (!el.matches?.("select") || el.matches(".aa-mascot-area") || !(/city|heroArea/i.test(el.id + " " + el.name) || /المركز/.test(el.getAttribute("aria-label") || ""))) return;
    const value = String(el.value || "").trim();
    if (value && value.length < 40) send("search", { target: "مركز: " + value });
  }, true);
  window.addEventListener("asyut:home-area", () => send("search", { target: "منطقة الزائر: " + regionNow() }));
  window.addEventListener("layan-auth-state-changed", e => { if (e.detail?.authenticated) send("login"); });
})();
