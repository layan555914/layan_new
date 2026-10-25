
(function () {
  "use strict";

  const config = window.LAYAN_CONFIG;

  if (!config?.SUPABASE_URL || !config?.SUPABASE_PUBLISHABLE_KEY) {
    console.error("LAYAN: إعدادات Supabase غير مكتملة.");
    return;
  }

  const url = config.SUPABASE_URL.replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY;
  const bucket = "layan_real_estat";

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

    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Supabase ${response.status}: ${body}`);
    }

    return body ? JSON.parse(body) : null;
  }

  async function getOffers() {
    const fields = [
      "id",
      "title",
      "governorate",
      "area",
      "property_type",
      "description",
      "total_price",
      "down_payment",
      "paid_amount",
      "remaining_amount",
      "assignment_fee",
      "assignment_fee_percentage",
      "discount_amount",
      "developer_name",
      "image_urls",
      "status",
      "featured_requested",
      "is_featured",
      "featured_until",
      "promotion_status",
      "created_at"
    ].join(",");

    const rows = await request(
      `property_offers?select=${fields}` +
      "&status=eq.available&order=created_at.desc"
    );

    return Array.isArray(rows) ? rows : [];
  }

  async function uploadImages(files) {
    const uploaded = [];

    for (const file of files || []) {
      if (!file.type.startsWith("image/")) {
        throw new Error("اختر ملفات صور فقط.");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("حجم الصورة يجب ألا يتجاوز 10 ميجابايت.");
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const path = `offers/${Date.now()}-${uniqueId}-${safeName}`;

      const response = await fetch(
        `${url}/storage/v1/object/${bucket}/${path}`,
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
        throw new Error(
          "فشل رفع الصورة: " + await response.text()
        );
      }

      uploaded.push(
        `${url}/storage/v1/object/public/${bucket}/` +
        path.split("/").map(encodeURIComponent).join("/")
      );
    }

    return uploaded;
  }

  async function createOffer(offer) {
    const payload = {
      title: offer.title,
      governorate: "أسيوط",
      area: offer.area || null,
      property_type: offer.property_type || "شقة",
      description: offer.description || null,
      total_price: Number(offer.total_price || 0),
      down_payment: Number(offer.down_payment || 0),
      paid_amount: Number(offer.paid_amount || 0),
      remaining_amount: Number(
        offer.remaining_amount ?? offer.remaining_installments ?? 0
      ),
      assignment_fee: Number(offer.assignment_fee ?? offer.transfer_fee ?? 0),
      assignment_fee_percentage: Number(
        offer.assignment_fee_percentage ?? offer.transfer_fee_percentage ?? 0
      ),
      discount_amount: Number(offer.discount_amount || 0),
      developer_name: offer.developer_name || null,
      contact_name: offer.contact_name || null,
      discount_percent: Number(offer.discount_percent || 0),
      contact_phone: offer.contact_phone || null,
      image_urls: Array.isArray(offer.image_urls)
        ? offer.image_urls
        : [],
      featured_requested: offer.featured_requested === true,
      is_featured: false,
      promotion_status: offer.featured_requested === true ? "requested" : "none",
      status: "pending"
    };

    const rows = await request("property_offers", {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });

    return Array.isArray(rows) ? rows[0] : rows;
  }

  window.LAYAN_SUPABASE = {
    getOffers,
    uploadImages,
    createOffer
  };

  console.log("LAYAN: اتصال Supabase جاهز.");
})();
