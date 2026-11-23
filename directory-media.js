(function () {
  "use strict";
  const cfg = window.LAYAN_CONFIG || {};
  const base = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  const bucket = "asyut-directory-media";
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  const auth = () => window.LAYAN_SUPABASE;
  function fileExtension(type) {
    return ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/avif":"avif" })[type] || "";
  }
  async function session() {
    const client = auth();
    if (!client?.requireAuthenticated) throw new Error("سجّل الدخول بحسابك على أسيوط عقار أولًا.");
    const value = await client.requireAuthenticated();
    if (!value?.access_token || !value?.user?.id) throw new Error("تعذر التحقق من جلسة الحساب.");
    return value;
  }
  async function request(path, options, token) {
    const response = await fetch(base + path, {
      ...options,
      headers: {
        apikey: key,
        Authorization: "Bearer " + (token || key),
        ...(options?.headers || {})
      }
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
    if (!response.ok) {
      const detail = data?.message || data?.details || data?.error || data?.hint;
      throw new Error(detail || ("تعذر تنفيذ طلب الصور (HTTP " + response.status + ")."));
    }
    return data;
  }
  function storagePath(path) {
    return String(path).split("/").map(encodeURIComponent).join("/");
  }
  async function signedUrl(path, token) {
    const result = await request("/storage/v1/object/sign/" + bucket + "/" + storagePath(path), {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ expiresIn: 3600 })
    }, token);
    const signed = result?.signedURL || result?.signedUrl;
    if (!signed) throw new Error("تعذر تجهيز رابط عرض الصورة.");
    return /^https?:\/\//i.test(signed) ? signed : base + (signed.startsWith("/") ? signed : "/" + signed);
  }
  async function renderGallery(options) {
    const root = options?.root;
    const entityId = String(options?.entityId || "");
    const projectId = String(options?.projectId || "");
    if (!root || !base || !key) return;
    if (projectId && !/^[0-9a-f-]{36}$/i.test(projectId)) return;
    if (!projectId && !/^[0-9a-f-]{36}$/i.test(entityId)) return;
    const query = new URLSearchParams({
      select:"id,media_kind,storage_path,caption,sort_order,created_at",
      status:"eq.approved",
      order:"sort_order.asc,created_at.asc",
      limit:"60"
    });
    if (projectId) {
      query.set("project_id", "eq." + projectId);
      query.set("media_kind", "eq.project_gallery");
    } else {
      query.set("directory_entity_id", "eq." + entityId);
      query.set("project_id", "is.null");
      query.set("media_kind", "in.(entity_cover,entity_gallery,service_gallery)");
    }
    let rows = [];
    try {
      rows = await request("/rest/v1/directory_media_assets?" + query.toString(), { method:"GET" });
    } catch (error) {
      console.warn("Approved directory media is not available:", error);
      return;
    }
    if (!Array.isArray(rows) || !rows.length) return;
    const images = [];
    for (const row of rows) {
      try {
        const url = await signedUrl(row.storage_path);
        images.push({ url, caption:row.caption || "" });
      } catch (error) {
        console.warn("A directory media image could not be signed:", error);
      }
    }
    if (!images.length || root.querySelector("[data-directory-media-gallery]")) return;
    const section = document.createElement("section");
    section.className = projectId ? "project-section directory-media-gallery" : "company-profile-section directory-media-gallery";
    section.dataset.directoryMediaGallery = "true";
    const heading = projectId ? "صور المشروع المعتمدة" : "معرض الصور والأعمال";
    section.innerHTML = "<h2>" + heading + "</h2><div class=\"directory-media-grid\">" +
      images.map((item, index) => "<figure><img src=\"" + esc(item.url) + "\" alt=\"" +
        esc(item.caption || heading + " " + (index + 1)) + "\" loading=\"lazy\"><figcaption>" +
        esc(item.caption) + "</figcaption></figure>").join("") + "</div>";
    root.appendChild(section);
  }
  async function loadEligibleProjects(entityId, token) {
    const links = await request("/rest/v1/directory_project_entities?select=project_id,relation_type&entity_id=eq." +
      encodeURIComponent(entityId) + "&relation_type=in.(developer,land_owner)", { method:"GET" }, token);
    const ids = [...new Set((Array.isArray(links) ? links : []).map(row => row.project_id).filter(Boolean))];
    if (!ids.length) return [];
    const projects = await request("/rest/v1/directory_projects?select=id,name_ar,public_visible,verification_status&id=in.(" +
      ids.map(encodeURIComponent).join(",") + ")&public_visible=eq.true&verification_status=eq.published&order=name_ar.asc",
      { method:"GET" }, token);
    return Array.isArray(projects) ? projects : [];
  }
  async function mountManager(options) {
    const root = options?.root;
    const entityId = String(options?.entityId || "");
    if (!root || !/^[0-9a-f-]{36}$/i.test(entityId) || root.querySelector("[data-directory-media-manager]")) return;
    const panel = document.createElement("section");
    panel.className = "company-profile-section directory-media-manager";
    panel.dataset.directoryMediaManager = "true";
    panel.innerHTML =
      "<h3>رفع صور الشركة والمشروعات</h3>" +
      "<p>ارفع صورًا واضحة بصيغة JPG أو PNG أو WEBP أو AVIF، بحد أقصى 10 ميجابايت للصورة. الصور لا تظهر للزوار إلا بعد مراجعة الإدارة واعتمادها.</p>" +
      "<form class=\"directory-media-upload-form\">" +
      "<label>نوع الصور<select name=\"media_kind\" required>" +
      "<option value=\"entity_gallery\">صور الشركة والأعمال</option>" +
      "<option value=\"entity_cover\">صورة غلاف الشركة</option>" +
      (options.isServiceProvider ? "<option value=\"service_gallery\">صور الخدمات</option>" : "") +
      "</select></label>" +
      "<label data-project-select hidden>المشروع<select name=\"project_id\"></select></label>" +
      "<label>وصف مختصر للصورة (اختياري)<input name=\"caption\" maxlength=\"240\" placeholder=\"مثال: مشروع سكني – واجهة المبنى\"></label>" +
      "<label>اختيار الصور<input name=\"files\" type=\"file\" accept=\"image/jpeg,image/png,image/webp,image/avif\" multiple required></label>" +
      "<button class=\"btn btn-gold\" type=\"submit\">إرسال الصور للمراجعة</button>" +
      "</form><p class=\"directory-media-status\" role=\"status\" aria-live=\"polite\"></p>";
    root.appendChild(panel);
    const form = panel.querySelector("form");
    const status = panel.querySelector(".directory-media-status");
    const kind = form.elements.media_kind;
    const projectWrap = form.querySelector("[data-project-select]");
    const projectSelect = form.elements.project_id;
    let eligibleProjects = [];
    try {
      const current = await session();
      eligibleProjects = await loadEligibleProjects(entityId, current.access_token);
    } catch (error) {
      status.textContent = error.message || "تعذر تحميل صلاحيات رفع الصور.";
      form.querySelector("button").disabled = true;
      return;
    }
    if (eligibleProjects.length) {
      projectSelect.innerHTML = '<option value="">اختر المشروع</option>' + eligibleProjects.map(project =>
        '<option value="' + esc(project.id) + '">' + esc(project.name_ar || "مشروع") + "</option>").join("");
      const option = document.createElement("option");
      option.value = "project_gallery";
      option.textContent = "صور مشروع منشور";
      kind.appendChild(option);
    }
    kind.addEventListener("change", () => {
      projectWrap.hidden = kind.value !== "project_gallery";
      projectSelect.required = kind.value === "project_gallery";
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector("button");
      const files = [...(form.elements.files.files || [])];
      if (!files.length) { status.textContent = "اختر صورة واحدة على الأقل."; return; }
      if (files.length > 8) { status.textContent = "يمكن إرسال 8 صور كحد أقصى في كل مرة."; return; }
      if (kind.value === "project_gallery" && !projectSelect.value) { status.textContent = "اختر المشروع أولًا."; return; }
      button.disabled = true;
      let uploaded = 0;
      try {
        const current = await session();
        for (const file of files) {
          if (!allowed.has(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
            throw new Error("كل صورة يجب أن تكون بصيغة JPG أو PNG أو WEBP أو AVIF وألا تتجاوز 10 ميجابايت.");
          }
          const ext = fileExtension(file.type);
          const path = entityId + "/" + current.user.id + "/" + crypto.randomUUID() + "." + ext;
          const bytes = await file.arrayBuffer();
          const storageResponse = await fetch(base + "/storage/v1/object/" + bucket + "/" + storagePath(path), {
            method:"POST",
            headers:{
              apikey:key,
              Authorization:"Bearer " + current.access_token,
              "Content-Type":file.type,
              "x-upsert":"false",
              "cache-control":"3600"
            },
            body:bytes
          });
          if (!storageResponse.ok) {
            const detail = await storageResponse.json().catch(() => ({}));
            throw new Error(detail.message || "تعذر رفع الصورة إلى التخزين الآمن.");
          }
          const payload = {
            directory_entity_id:entityId,
            project_id:kind.value === "project_gallery" ? projectSelect.value : null,
            owner_user_id:current.user.id,
            media_kind:kind.value,
            bucket_id:bucket,
            storage_path:path,
            caption:String(form.elements.caption.value || "").trim()
          };
          try {
            await request("/rest/v1/directory_media_assets", {
              method:"POST",
              headers:{ "Content-Type":"application/json", "Prefer":"return=minimal" },
              body:JSON.stringify(payload)
            }, current.access_token);
          } catch (error) {
            await fetch(base + "/storage/v1/object/" + bucket + "/" + storagePath(path), {
              method:"DELETE",
              headers:{ apikey:key, Authorization:"Bearer " + current.access_token }
            }).catch(() => {});
            throw error;
          }
          uploaded++;
        }
        form.reset();
        projectWrap.hidden = true;
        projectSelect.required = false;
        status.textContent = "تم إرسال " + uploaded + " صورة للمراجعة. ستظهر بعد اعتماد الإدارة.";
      } catch (error) {
        status.textContent = (uploaded ? "تم إرسال " + uploaded + " صورة. " : "") +
          (error.message || "تعذر إرسال الصور.");
      } finally {
        button.disabled = false;
      }
    });
  }
  window.AsyutDirectoryMedia = { renderGallery, mountManager };
})();