#!/usr/bin/env node
// Builds one static page per published listing (ads/<id>.html) plus sitemap.xml.
// Why: the site is static, so link previews (WhatsApp, Facebook) and search engines
// only see what is in the HTML file. Each generated page carries the listing's own
// title, price, photo and structured data, then property.js loads the live details.
//
// Usage: node scripts/build-listing-pages.mjs [--offers-file demo.json]
// Reads the public, read-only listing data with the publishable key from config.js.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.asyutq.com";
const ADS_DIR = path.join(root, "ads");
const MANIFEST = path.join(ADS_DIR, "manifest.json");
const DEFAULT_IMAGE = SITE + "/assets/brand/og-image.jpg";

const STATIC_PAGES = [
  ["/", "daily", "1.0"],
  ["/offers.html", "daily", "1.0"],
  ["/marketplace.html", "weekly", "0.8"],
  ["/companies.html", "weekly", "0.8"],
  ["/directory.html", "weekly", "0.7"],
  ["/guide.html", "monthly", "0.6"],
  ["/advertise.html", "monthly", "0.6"],
  ["/about.html", "monthly", "0.5"],
  ["/payment.html", "monthly", "0.5"],
  ["/terms.html", "yearly", "0.3"],
  ["/privacy.html", "yearly", "0.3"]
];

// One landing page per Assiut center: areas/<slug>.html (offers page preset to that city).
export const AREAS = [
  ["assiut-city", "مدينة أسيوط", "عاصمة المحافظة وأكبر سوق عقاري فيها: شقق قريبة من الجامعة والمستشفيات والخدمات، ومحلات ومكاتب وعيادات في الشوارع التجارية."],
  ["new-assiut", "أسيوط الجديدة", "أحياء مخططة ومشروعات إسكان وتنازلات عن وحدات وأراضٍ، مع تفاصيل المقدم والمدفوع والمتبقي والأقساط لكل عرض."],
  ["dairut", "ديروط", "شقق وبيوت وأراضٍ ومحلات في مركز ديروط شمال محافظة أسيوط، للبيع والإيجار والتنازل."],
  ["el-qusiya", "القوصية", "عقارات مركز القوصية: شقق وبيوت وأراضٍ زراعية وسكنية ومحلات للبيع والإيجار."],
  ["manfalut", "منفلوط", "عقارات مركز منفلوط شمال مدينة أسيوط: شقق وبيوت وأراضٍ ومحلات للبيع والإيجار والتنازل."],
  ["abnub", "أبنوب", "عقارات مركز أبنوب: شقق وبيوت وأراضٍ ومحلات معروضة للبيع والإيجار."],
  ["el-fath", "الفتح", "عقارات مركز الفتح: شقق وبيوت وأراضٍ ومحلات للبيع والإيجار والتنازل."],
  ["sahel-selim", "ساحل سليم", "عقارات مركز ساحل سليم: شقق وبيوت وأراضٍ ومحلات للبيع والإيجار."],
  ["el-badari", "البداري", "عقارات مركز البداري: شقق وبيوت وأراضٍ ومحلات للبيع والإيجار والتنازل."],
  ["abu-tig", "أبو تيج", "عقارات مركز أبو تيج جنوب المحافظة: شقق وبيوت وأراضٍ ومحلات للبيع والإيجار."],
  ["sidfa", "صدفا", "عقارات مركز صدفا: شقق وبيوت وأراضٍ ومحلات للبيع والإيجار والتنازل."],
  ["el-ghanayem", "الغنايم", "عقارات مركز الغنايم: شقق وبيوت وأراضٍ ومحلات للبيع والإيجار."]
];
const AREAS_DIR = path.join(root, "areas");

const FIELDS = [
  "id", "title", "governorate", "listing_purpose", "city", "area", "area_m2", "bedrooms", "bathrooms",
  "property_type", "description", "total_price", "down_payment", "remaining_amount", "monthly_installment",
  "project_name", "developer_name", "image_urls", "created_at", "updated_at"
].join(",");

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n).toLocaleString("en-US") + " ج.م" : "";
};
const offerCode = row => "ASY-" + String(row.id).padStart(4, "0");
const firstImage = row => (Array.isArray(row.image_urls) ? row.image_urls : [])
  .map(v => { try { const u = new URL(String(v || "")); return u.protocol === "https:" ? u.href : ""; } catch (_) { return ""; } })
  .find(Boolean) || "";
const isoDay = value => { const d = new Date(value || ""); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); };

function readConfig() {
  const source = fs.readFileSync(path.join(root, "config.js"), "utf8");
  const url = source.match(/SUPABASE_URL:\s*"(https:\/\/ebyhwqkmhxbgocngpqfe\.supabase\.co)"/);
  const key = source.match(/ebyhwqkmhxbgocngpqfe\.supabase\.co",\s*SUPABASE_PUBLISHABLE_KEY:\s*"([^"]+)"/);
  if (!url || !key) throw new Error("Production Supabase settings not found in config.js");
  return { url: url[1], key: key[1] };
}

async function loadOffers() {
  const fileArg = process.argv.indexOf("--offers-file");
  if (fileArg > -1) return JSON.parse(fs.readFileSync(process.argv[fileArg + 1], "utf8"));
  const { url, key } = readConfig();
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/property_offers?select=${FIELDS}&status=eq.available&order=id.asc`, {
      headers: { apikey: key, Authorization: "Bearer " + key, Range: `${from}-${from + 999}` }
    });
    if (!response.ok) throw new Error("Listing request failed: " + response.status + " " + (await response.text()).slice(0, 200));
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function listingPage(template, row) {
  const id = String(row.id);
  if (!/^[1-9][0-9]{0,18}$/.test(id)) return null;
  const title = String(row.title || "إعلان عقاري").trim();
  const purpose = String(row.listing_purpose || "بيع");
  const place = [row.city, row.area].filter(Boolean).join(" · ") || "أسيوط";
  const price = money(row.total_price);
  const pageUrl = `${SITE}/ads/${id}.html`;
  const image = firstImage(row) || DEFAULT_IMAGE;
  const headline = `${title}${price ? " — " + price : ""}`;
  const specs = [
    row.property_type, purpose, place,
    row.area_m2 ? row.area_m2 + " م²" : "",
    row.bedrooms ? row.bedrooms + " غرف" : ""
  ].filter(Boolean).join(" · ");
  const description = (specs + ". " + String(row.description || "")).replace(/\s+/g, " ").trim().slice(0, 155);
  const schema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: title,
    description,
    url: pageUrl,
    image: firstImage(row) ? [firstImage(row)] : undefined,
    datePosted: row.created_at || undefined,
    dateModified: row.updated_at || undefined,
    address: { "@type": "PostalAddress", addressLocality: row.city || "أسيوط", addressRegion: row.governorate || "أسيوط", addressCountry: "EG" },
    offers: Number(row.total_price) > 0 ? { "@type": "Offer", price: Number(row.total_price), priceCurrency: "EGP", availability: "https://schema.org/InStock" } : undefined
  };

  let html = template;
  const swap = (pattern, value) => {
    if (!pattern.test(html)) throw new Error("Template is missing " + pattern);
    html = html.replace(pattern, value);
  };
  swap(/<meta charset="utf-8">/, '<meta charset="utf-8">\n  <base href="/">');
  swap(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`);
  swap(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="article">');
  swap(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(headline)}">`);
  swap(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`);
  swap(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${pageUrl}">`);
  swap(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${pageUrl}">`);
  swap(/<title>[^<]*<\/title>/, `<title>${esc(title)} | أسيوط عقار</title>`);
  swap(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(image)}">`);
  swap(/<meta property="og:image:secure_url" content="[^"]*">/, `<meta property="og:image:secure_url" content="${esc(image)}">`);
  swap(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(image)}">`);
  swap(/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(title)}">`);
  if (image !== DEFAULT_IMAGE) {
    html = html.replace(/\s*<meta property="og:image:(type|width|height)" content="[^"]*">/g, "");
  }
  swap(/<\/head>/, `  <script type="application/ld+json" id="propertyStructuredData">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>\n</head>`);
  // Readable content for crawlers and for the first paint; property.js replaces it with the full view.
  const preview = `<section class="property-state property-static-preview">
        ${firstImage(row) ? `<img src="${esc(firstImage(row))}" alt="${esc(title)}" width="1200" height="800" fetchpriority="high">` : ""}
        <p class="property-listing-code">كود الإعلان: <strong>${esc(offerCode(row))}</strong></p>
        <h1>${esc(title)}</h1>
        <p>${esc(specs)}</p>
        ${price ? `<p><strong>${esc(price)}</strong></p>` : ""}
        ${row.description ? `<p>${esc(String(row.description).slice(0, 600))}</p>` : ""}
      </section>`;
  swap(/<section class="property-state"><h1>جارٍ فتح الإعلان<\/h1><p>[^<]*<\/p><\/section>/, preview);
  swap(/<script src="\.\/config\.js(\?[^"]*)?"><\/script>/, match => `<script>window.ASYUT_PROPERTY_ID = "${id}";</script>\n  ${match}`);
  return html;
}

function areaPage(template, [slug, name, intro], rows) {
  const pageUrl = `${SITE}/areas/${slug}.html`;
  const title = `عقارات ${name} للبيع والإيجار والتنازل`;
  const description = `${intro} تصفح العروض المنشورة في ${name} على أسيوط عقار وتواصل مباشرة مع المعلن بدون عمولة.`.slice(0, 160);
  let html = template;
  const swap = (pattern, value) => {
    if (!pattern.test(html)) throw new Error("Offers template is missing " + pattern);
    html = html.replace(pattern, value);
  };
  swap(/<meta charset="utf-8">/, '<meta charset="utf-8">\n  <base href="/">');
  swap(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`);
  swap(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${pageUrl}">`);
  swap(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${pageUrl}">`);
  swap(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)} | أسيوط عقار">`);
  swap(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`);
  swap(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(title)} | أسيوط عقار">`);
  swap(/<title>[^<]*<\/title>/, `<title>${esc(title)} | أسيوط عقار</title>`);
  swap(/<span class="eyebrow">العقارات · محافظة أسيوط<\/span>/, `<span class="eyebrow">العقارات · ${esc(name)}</span>`);
  swap(/<h1 id="offersPageTitle">[\s\S]*?<\/h1>/, `<h1 id="offersPageTitle">عقارات ${esc(name)} <span>للبيع والإيجار والتنازل</span></h1>`);
  swap(/(<h1 id="offersPageTitle">[\s\S]*?<\/h1>\s*<p>)[^<]*(<\/p>)/, `$1${esc(intro)}$2`);
  const local = rows.filter(row => String(row.city || "").trim() === name);
  const links = local.map(row => `<li><a href="/ads/${row.id}.html">${esc(row.title || "إعلان عقاري")}${money(row.total_price) ? " — " + esc(money(row.total_price)) : ""}</a></li>`).join("");
  swap(/<\/head>/, `  <script>window.ASYUT_PRESET_FILTERS = ${JSON.stringify({ city: name })};</script>\n</head>`);
  swap(/(<section class="offers-section" id="offers">)/, `<noscript><ul class="area-static-links">${links || "<li>لا توجد عروض منشورة في " + esc(name) + " حاليًا.</li>"}</ul></noscript>\n$1`);
  return html;
}

function sitemap(rows) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = STATIC_PAGES
    .filter(([p]) => p === "/" || fs.existsSync(path.join(root, p.slice(1))))
    .map(([p, freq, pr]) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${pr}</priority></url>`);
  for (const [slug] of AREAS) {
    urls.push(`  <url><loc>${SITE}/areas/${slug}.html</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`);
  }
  for (const row of rows) {
    const day = isoDay(row.updated_at || row.created_at) || today;
    urls.push(`  <url><loc>${SITE}/ads/${row.id}.html</loc><lastmod>${day}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

const template = fs.readFileSync(path.join(root, "property.html"), "utf8");
const rows = (await loadOffers()).filter(row => /^[1-9][0-9]{0,18}$/.test(String(row?.id ?? "")));
fs.mkdirSync(ADS_DIR, { recursive: true });

// Only files this script created before are removed when a listing is no longer published.
const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")).files || [] : [];
const written = [];
for (const row of rows) {
  const html = listingPage(template, row);
  if (!html) continue;
  const name = `${row.id}.html`;
  const target = path.join(ADS_DIR, name);
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== html) fs.writeFileSync(target, html);
  written.push(name);
}
for (const name of previous) {
  if (!written.includes(name) && /^[0-9]+\.html$/.test(name)) fs.rmSync(path.join(ADS_DIR, name), { force: true });
}
fs.writeFileSync(MANIFEST, JSON.stringify({ files: written.sort((a, b) => parseInt(a) - parseInt(b)) }, null, 2) + "\n");
// Area landing pages
const offersTemplate = fs.readFileSync(path.join(root, "offers.html"), "utf8");
fs.mkdirSync(AREAS_DIR, { recursive: true });
for (const area of AREAS) {
  const html = areaPage(offersTemplate, area, rows);
  const target = path.join(AREAS_DIR, area[0] + ".html");
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== html) fs.writeFileSync(target, html);
}

const map = sitemap(rows.filter(row => written.includes(`${row.id}.html`)));
const current = fs.existsSync(path.join(root, "sitemap.xml")) ? fs.readFileSync(path.join(root, "sitemap.xml"), "utf8") : "";
// Keep lastmod of static pages stable unless the listing set changed, to avoid empty commits.
if (current.replace(/<lastmod>[^<]*<\/lastmod>/g, "") !== map.replace(/<lastmod>[^<]*<\/lastmod>/g, "")) {
  fs.writeFileSync(path.join(root, "sitemap.xml"), map);
}
console.log(`Area pages: ${AREAS.length}.`);
console.log(`Listing pages: ${written.length} written, ${previous.filter(n => !written.includes(n)).length} removed.`);
