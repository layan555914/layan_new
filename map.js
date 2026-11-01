(() => {
  "use strict";
  const panel = document.getElementById("propertyMapPanel");
  const toggle = document.getElementById("togglePropertyMap");
  const status = document.getElementById("propertyMapStatus");
  const count = document.getElementById("propertyMapCount");
  const mapNode = document.getElementById("propertyMap");
  if (!panel || !toggle || !mapNode) return;
  let leafletPromise = null;
  let map = null;
  let markerLayer = null;
  let lastOffers = Array.isArray(window.LAYAN_FILTERED_PROPERTY_OFFERS) ? window.LAYAN_FILTERED_PROPERTY_OFFERS : [];
  const validCoordinates = offer => {
    const lat = Number(offer.latitude), lng = Number(offer.longitude);
    return offer.latitude !== null && offer.longitude !== null &&
      offer.latitude !== undefined && offer.longitude !== undefined &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  };
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "anonymous";
        link.dataset.leafletCss = "1";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error("تعذر تجهيز مكتبة الخريطة."));
      script.onerror = () => reject(new Error("تعذر تحميل مكتبة الخريطة. تحقق من اتصال الإنترنت."));
      document.head.appendChild(script);
    });
    return leafletPromise;
  }
  function initMap(L) {
    if (map) return;
    map = L.map(mapNode, { scrollWheelZoom: false, preferCanvas: true }).setView([27.18, 31.18], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      minZoom: 5,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      updateWhenZooming: false,
      keepBuffer: 1
    }).addTo(map);
    markerLayer = L.featureGroup().addTo(map);
  }
  function paintMarkers(L) {
    if (!map || !markerLayer) return;
    markerLayer.clearLayers();
    const located = lastOffers.filter(validCoordinates);
    count.textContent = located.length + " عقار له موقع مسجل";
    if (!located.length) {
      status.textContent = "لا توجد عروض مطابقة للفلاتر لها إحداثيات مسجلة بعد. لن نعرض مواقع تقديرية.";
      return;
    }
    const bounds = [];
    for (const offer of located) {
      const lat = Number(offer.latitude), lng = Number(offer.longitude);
      const marker = L.marker([lat, lng]).addTo(markerLayer);
      const popup = document.createElement("div");
      popup.className = "map-offer-popup";
      const title = document.createElement("strong");
      title.textContent = offer.title || "عقار";
      const location = document.createElement("span");
      location.textContent = [offer.city, offer.area].filter(Boolean).join(" · ") || "أسيوط";
      const price = document.createElement("span");
      price.textContent = Number(offer.total_price || 0).toLocaleString("ar-EG") + " جنيه";
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "عرض التفاصيل";
      open.addEventListener("click", () => window.dispatchEvent(new CustomEvent("layan-open-offer", { detail: { id: offer.id } })));
      popup.append(title, location, price, open);
      marker.bindPopup(popup);
      bounds.push([lat, lng]);
    }
    if (bounds.length === 1) map.setView(bounds[0], 14);
    else map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    status.textContent = "تظهر " + located.length + " مواقع مؤكدة ضمن العروض الحالية. اضغط على أي علامة لعرض التفاصيل.";
    window.setTimeout(() => map.invalidateSize(), 80);
  }
  async function showMap() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = "إخفاء الخريطة";
    status.textContent = "جارٍ تحميل الخريطة...";
    try {
      const L = await loadLeaflet();
      initMap(L);
      paintMarkers(L);
    } catch (error) {
      status.textContent = error.message || "تعذر فتح الخريطة.";
    }
  }
  toggle.addEventListener("click", () => {
    if (!panel.hidden) {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "عرض الخريطة";
      return;
    }
    showMap();
  });
  window.addEventListener("layan-offers-rendered", event => {
    lastOffers = Array.isArray(event.detail?.offers) ? event.detail.offers : [];
    const located = lastOffers.filter(validCoordinates).length;
    count.textContent = located + " عقار له موقع مسجل";
    if (map && window.L) paintMarkers(window.L);
  });
  window.addEventListener("resize", () => {
    if (map && !panel.hidden) map.invalidateSize();
  });
})();