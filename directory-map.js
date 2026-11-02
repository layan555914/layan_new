(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const panel = $("#directoryMapPanel");
  const toggle = $("#toggleDirectoryMap");
  const mapNode = $("#directoryMap");
  const status = $("#directoryMapStatus");
  const count = $("#directoryMapCount");
  const areaLinks = $("#directoryMapAreaLinks");
  if (!panel || !toggle || !mapNode) return;

  const config = window.LAYAN_CONFIG || {};
  const base = String(config.SUPABASE_URL || "").replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY || "";
  const data = { entities: [], projects: [], areas: [], sources: [] };
  let leafletPromise = null;
  let map = null;
  let layer = null;
  let opened = false;

  function validPoint(row) {
    const lat = Number(row.map_latitude);
    const lng = Number(row.map_longitude);
    return row.map_latitude !== null && row.map_longitude !== null &&
      row.map_latitude !== undefined && row.map_longitude !== undefined &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
      Boolean(row.map_source_id);
  }

  async function readTable(table, select, fallbackSelect) {
    if (!base || !key) return [];
    const request = async fields => {
      const response = await fetch(base + "/rest/v1/" + table + "?select=" + fields, {
        headers: { apikey: key, Authorization: "Bearer " + key }
      });
      if (!response.ok) throw new Error("تعذر قراءة " + table);
      const rows = await response.json();
      return Array.isArray(rows) ? rows : [];
    };
    try {
      return await request(select);
    } catch (error) {
      if (!fallbackSelect) throw error;
      return await request(fallbackSelect);
    }
  }

  async function loadData() {
    const [entities, projects, areas, sources] = await Promise.all([
      readTable("directory_entities",
        "id,name_ar,entity_type,primary_area_id,map_latitude,map_longitude,map_location_kind,map_source_id&public_visible=eq.true&verification_status=eq.published",
        "id,name_ar,entity_type,primary_area_id&public_visible=eq.true&verification_status=eq.published"),
      readTable("directory_projects",
        "id,name_ar,project_type,location_text,area_id,map_latitude,map_longitude,map_location_kind,map_source_id&public_visible=eq.true&verification_status=eq.published",
        "id,name_ar,project_type,location_text,area_id&public_visible=eq.true&verification_status=eq.published"),
      readTable("directory_areas",
        "id,name_ar,area_type,map_latitude,map_longitude,map_location_kind,map_source_id&public_visible=eq.true&verification_status=eq.published&is_active=eq.true",
        "id,name_ar,area_type&public_visible=eq.true&verification_status=eq.published&is_active=eq.true"),
      readTable("directory_sources",
        "id,title,publisher,source_url,is_public&is_public=eq.true",
        "id,title,publisher,source_url,is_public&is_public=eq.true")
    ]);
    data.entities = entities;
    data.projects = projects;
    data.areas = areas;
    data.sources = sources;
    renderAreaLinks();
    addCardMapLinks();
  }

  function mapsSearch(query) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  function sourceFor(row) {
    return data.sources.find(source => String(source.id) === String(row.map_source_id) && source.is_public === true);
  }

  function allMapRecords() {
    return [
      ...data.entities.map(row => ({ ...row, mapType: "جهة / مطور", mapLocation: data.areas.find(a => String(a.id) === String(row.primary_area_id))?.name_ar || "أسيوط" })),
      ...data.projects.map(row => ({ ...row, mapType: "مشروع", mapLocation: row.location_text || data.areas.find(a => String(a.id) === String(row.area_id))?.name_ar || "أسيوط" })),
      ...data.areas.map(row => ({ ...row, mapType: "منطقة", mapLocation: row.name_ar }))
    ];
  }

  function activeMapRecords() {
    const active = $(".directory-tabs button.is-active");
    const view = active?.dataset.view || "entities";
    const q = ($("#directorySearch")?.value || "").trim().toLocaleLowerCase("ar");
    const area = $("#directoryAreaFilter")?.value || "";
    const type = $("#directoryTypeFilter")?.value || "";
    let rows = view === "entities" ? data.entities :
      view === "projects" ? data.projects :
      view === "areas" ? data.areas : [];
    return rows.filter(row => {
      if (q && ![row.name_ar, row.description, row.location_text].filter(Boolean).join(" ").toLocaleLowerCase("ar").includes(q)) return false;
      if (view === "entities" && type && row.entity_type !== type) return false;
      if (area && view === "entities" && String(row.primary_area_id || "") !== area) return false;
      if (area && view === "projects" && String(row.area_id || "") !== area && !String(row.location_text || "").includes(area)) return false;
      if (area && view === "areas" && String(row.id || "") !== area) return false;
      return true;
    }).map(row => ({ ...row, mapType: view === "entities" ? "جهة / مطور" : view === "projects" ? "مشروع" : "منطقة",
      mapLocation: row.location_text || row.name_ar }));
  }

  function renderAreaLinks() {
    if (!areaLinks) return;
    const rows = data.areas.length ? data.areas : [];
    areaLinks.replaceChildren();
    rows.forEach(area => {
      const link = document.createElement("a");
      link.href = mapsSearch(area.name_ar + "، محافظة أسيوط، مصر");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = area.name_ar;
      areaLinks.append(link);
    });
    if (!rows.length) areaLinks.textContent = "لا توجد مناطق منشورة حاليًا.";
  }

  function addCardMapLinks() {
    document.querySelectorAll("#directoryResults .directory-card").forEach(card => {
      if (card.querySelector(".directory-map-link")) return;
      const title = card.querySelector("h3")?.textContent?.trim();
      if (!title) return;
      const view = $(".directory-tabs button.is-active")?.dataset.view || "entities";
      const sourceRows = view === "entities" ? data.entities : view === "projects" ? data.projects : view === "areas" ? data.areas : [];
      const row = sourceRows.find(item => item.name_ar === title);
      const source = row && validPoint(row) ? sourceFor(row) : null;
      const exact = Boolean(source && validPoint(row));
      const location = row?.location_text || card.querySelector("small")?.textContent || card.querySelector("p")?.textContent || "أسيوط";
      const href = exact
        ? mapsSearch(Number(row.map_latitude) + "," + Number(row.map_longitude))
        : mapsSearch([title, location, "أسيوط، مصر"].filter(Boolean).join("، "));
      const link = document.createElement("a");
      link.className = "directory-map-link";
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = exact ? "فتح الإحداثيات المسجلة على الخريطة ↗" : "ابحث عن الاسم على الخريطة ↗";
      card.append(link);
    });
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector("link[data-directory-leaflet]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "anonymous";
        link.dataset.directoryLeaflet = "1";
        document.head.append(link);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error("تعذر تجهيز مكتبة الخرائط."));
      script.onerror = () => reject(new Error("تعذر تحميل الخريطة. تحقق من اتصال الإنترنت."));
      document.head.append(script);
    });
    return leafletPromise;
  }

  function initMap(L) {
    if (map) return;
    map = L.map(mapNode, { scrollWheelZoom: false, preferCanvas: true }).setView([27.18096, 31.18368], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      minZoom: 5, maxZoom: 19, updateWhenZooming: false, keepBuffer: 1,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    layer = L.featureGroup().addTo(map);
  }

  function paintMap(L) {
    if (!map || !layer) return;
    layer.clearLayers();
    const viewRows = activeMapRecords();
    const points = viewRows.filter(row => validPoint(row) && sourceFor(row));
    count.textContent = points.length + " موقع بإحداثيات ومصدر عام";
    points.forEach(row => {
      const marker = L.marker([Number(row.map_latitude), Number(row.map_longitude)]).addTo(layer);
      const popup = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = row.name_ar || "موقع في الدليل";
      const type = document.createElement("p");
      type.textContent = row.mapType + " · " + (row.map_location_kind === "area_reference" || row.map_location_kind === "area_center" ? "نقطة مرجعية للنطاق" : "موقع مسجل وفق المصدر");
      const source = sourceFor(row);
      const sourceLink = document.createElement("a");
      sourceLink.href = source.source_url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = "مصدر الموقع: " + (source.title || source.publisher || "مرجع منشور");
      popup.append(heading, type, sourceLink);
      marker.bindPopup(popup);
    });
    if (points.length === 1) map.setView([Number(points[0].map_latitude), Number(points[0].map_longitude)], 14);
    else if (points.length > 1) map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 14 });
    status.textContent = points.length
      ? "تظهر فقط المواقع التي لها إحداثيات صحيحة ومصدر عام مرتبط. اضغط على العلامة لمراجعة مصدر الموقع."
      : "لا توجد سجلات منشورة بإحداثيات موثقة حتى الآن. الخريطة مرجعية فقط، ولن نضع نقاطًا تقديرية.";
    map.invalidateSize();
  }

  async function openMap() {
    panel.hidden = false;
    opened = true;
    toggle.setAttribute("aria-expanded", "true");
    toggle.textContent = "إخفاء الخريطة";
    status.textContent = "جارٍ تحميل خريطة الدليل...";
    try {
      await loadData();
      const L = await loadLeaflet();
      initMap(L);
      paintMap(L);
    } catch (error) {
      status.textContent = error.message || "تعذر فتح الخريطة الآن.";
    }
  }

  toggle.addEventListener("click", () => {
    if (opened) {
      panel.hidden = true;
      opened = false;
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "عرض الخريطة التفاعلية";
      return;
    }
    openMap();
  });

  ["input", "change"].forEach(type => {
    ["#directorySearch", "#directoryAreaFilter", "#directoryTypeFilter"].forEach(selector => {
      $(selector)?.addEventListener(type, () => {
        addCardMapLinks();
        if (opened && window.L) paintMap(window.L);
      });
    });
  });
  document.querySelectorAll(".directory-tabs button").forEach(button => button.addEventListener("click", () => {
    addCardMapLinks();
    if (opened && window.L) paintMap(window.L);
  }));
  const results = $("#directoryResults");
  if (results) new MutationObserver(addCardMapLinks).observe(results, { childList: true, subtree: true });
  window.addEventListener("resize", () => { if (opened && map) map.invalidateSize(); });
})();
