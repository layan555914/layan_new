
(function () {
  "use strict";

  const config = window.LAYAN_CONFIG;

  if (
    !config?.SUPABASE_URL ||
    !config?.SUPABASE_PUBLISHABLE_KEY
  ) {
    console.error("LAYAN: إعدادات Supabase غير مكتملة.");
    return;
  }

  const url = config.SUPABASE_URL.replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY;
  const BUCKET = "layan_real_estat";

  async function request(path, options = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`قاعدة البيانات: ${message}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function uploadImages(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    const uploadedUrls = [];

    for (const file of files) {
      if (!file.type || !file.type.startsWith("image/")) {
        throw new Error("الملف المحدد ليس صورة.");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("حجم الصورة يجب ألا يتجاوز 10 ميجابايت.");
      }

      const safeName = file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");

      const path =
        `offers/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const response = await fetch(
        `${url}/storage/v1/object/${BUCKET}/${path}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": file.type,
            "x-upsert": "false"
          },
          body: file
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`تعذر رفع الصورة: ${message}`);
      }

      const publicUrl =
        `${url}/storage/v1/object/public/${BUCKET}/` +
        path.split("/").map(encodeURIComponent).join("/");

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  }

  window.LAYAN_SUPABASE = {
    async getOffers() {
      return request(
        "property_offers?select=*&order=created_at.desc"
      );
    },

    uploadImages,

    async createOffer(offer) {
      const payload = {
        title: offer.title,
        governorate: offer.governorate || "أسيوط",
        city: offer.city || "أسيوط",
        area: offer.area || null,
        property_type: offer.property_type || "شقة",
        total_price: Number(offer.total_price || 0),
        down_payment: Number(offer.down_payment || 0),
        paid_amount: Number(offer.paid_amount || 0),
        remaining_amount: Number(offer.remaining_amount || 0),
        assignment_fee: Number(offer.assignment_fee || 0),
        discount_percent: Number(offer.discount_percent || 0),
        contact_name: offer.contact_name || null,
        contact_phone: offer.contact_phone || null,
        description: offer.description || null,
        image_urls: Array.isArray(offer.image_urls)
          ? offer.image_urls
          : [],
        status: offer.status || "available"
      };

      const rows = await request("property_offers", {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });

      return rows?.[0] || null;
    }
  };

  console.log("LAYAN: تم تجهيز الاتصال ورفع الصور.");
})();
