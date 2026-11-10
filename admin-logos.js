// ASYUT AQAR admin — «شعارات وصور المعلنين»: approve / reject the logo an advertiser uploaded from «إعلاناتي».
// Approving is owner-only on the server; an added admin's click becomes an approval request automatically.
(() => {
  "use strict";
  let A = null;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const https = v => { try { const u = new URL(String(v || "")); return u.protocol === "https:" ? u.href : ""; } catch (_) { return ""; } };
  const rpc = (name, body = {}) => A.request("/rest/v1/rpc/" + name, { method: "POST", body: JSON.stringify(body) });
  const circle = (url, label) => url
    ? `<span class="as-logo" style="border-radius:50%"><img src="${esc(url)}" alt="${esc(label)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></span>`
    : '<span class="as-logo" style="border-radius:50%;display:grid;place-items:center;color:#A4472A">—</span>';

  async function load() {
    const box = $("pendingLogos");
    if (!box || !A) return;
    try {
      const rows = await rpc("layan_admin_list_pending_logos") || [];
      if (!rows.length) { box.innerHTML = '<p class="admin-empty">لا توجد شعارات بانتظار المراجعة.</p>'; return; }
      box.innerHTML = rows.map(r => `<div class="as-item" data-logo-user="${esc(r.user_id)}">
          ${circle(https(r.pending_logo_url), "الشعار الجديد")}
          <div class="as-info"><strong>${esc(r.email)}</strong><small>${r.logo_url ? "سيستبدل الشعار الحالي" : "أول شعار لهذا المعلن"} · ${r.pending_at ? new Date(r.pending_at).toLocaleString("ar-EG") : ""}</small>
            ${r.logo_url ? `<small style="display:flex;align-items:center;gap:6px">الحالي: <img src="${esc(https(r.logo_url))}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover"></small>` : ""}</div>
          <div class="as-actions"><button type="button" class="btn btn-gold" data-logo-approve="1">اعتماد</button><button type="button" class="btn btn-outline" data-logo-approve="0">رفض</button></div>
        </div>`).join("");
    } catch (e) {
      box.innerHTML = /layan_admin_list_pending_logos|PGRST20[02]|404|Could not find/i.test(String(e?.message || ""))
        ? '<p class="admin-empty admin-pending">تحتاج هذه الخاصية تطبيق تحديث قاعدة البيانات «شعارات المعلنين» (20261110190000).</p>'
        : `<p class="admin-empty">${esc(e.message)}</p>`;
    }
  }

  document.addEventListener("click", async event => {
    const btn = event.target.closest("[data-logo-approve]");
    if (!btn || !A) return;
    const row = btn.closest("[data-logo-user]");
    const approve = btn.dataset.logoApprove === "1";
    btn.disabled = true;
    try {
      await rpc("layan_admin_review_logo", { p_user: row.dataset.logoUser, p_approve: approve });
      A.setStatus(approve ? "تم اعتماد الشعار وظهر على إعلانات المعلن." : "تم رفض الشعار.");
      load();
    } catch (e) { A.setStatus(e.message); btn.disabled = false; }
  });

  window.addEventListener("asyut:admin-ready", () => { A = window.AsyutAdmin; load(); });
  if (window.AsyutAdmin) { A = window.AsyutAdmin; load(); }
  document.addEventListener("click", e => { if (e.target.closest("#reloadPending, [data-admin-reload]")) setTimeout(load, 300); });
})();
