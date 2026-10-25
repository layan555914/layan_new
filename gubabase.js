(function () {
  "use strict";

  const config = window.LAYAN_CONFIG;

  if (!config?.SUPABASE_URL || !config?.SUPABASE_PUBLISHABLE_KEY) {
    console.error("LAYAN: إعدادات Supabase غير مكتملة.");
    return;
  }

  const url = config.SUPABASE_URL.replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY;
  const BUCKET = "layan_real_estat";

  // الحقول العامة فقط، بدون اسم أو هاتف صاحب العرض.
  const PUBLIC_FIELDS = [
    "id",
    "title",
    "governorate",
    "city",
    "area",
    "property_type",
    "bedrooms",
    "bathrooms",
    "area_m2",
    "total_price",
    "down_payment",
    "paid_amount",
    "remaining_amount",
    "monthly_installment",
    "assignment_fee",
    "assignment_fee_percentage",
    "discount_amount",
    "discount_percent",
    "description",
    "image_urls",
    "developer_name",
    "status",
    "created_at",
    "verification_status",
    "developer_approval_status"
  ].join(",");

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

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`قاعدة البيانات: ${text}`);
    }

    return text ? JSON.parse(text) : null;
  }

  async function uploadImages(files) {
    if (!Array.isArray(files) || files.length === 0) return [];

    const uploadedUrls = [];

    for (const file of files) {
      if (!file.type?.startsWith("image/")) {
        throw new Error("الملف المحدد ليس صورة.");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("حجم الصورة يجب ألا يتجاوز 10 ميجابايت.");
      }

      const safeName = file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");

      const objectPath =
        `offers/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const response = await fetch(
        `${url}/storage/v1/object/${BUCKET}/${objectPath}`,
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
        throw new Error(`تعذر رفع الصورة: ${await response.text()}`);
      }

      uploadedUrls.push(
        `${url}/storage/v1/object/public/${BUCKET}/` +
        objectPath.split("/").map(encodeURIComponent).join("/")
      );
    }

    return uploadedUrls;
  }

  // جلب بيانات العرض العامة فقط.
  async function getOffers() {
    const rows = await request(
      `property_offers?select=${PUBLIC_FIELDS}` +
      "&status=eq.available&order=created_at.desc"
    );

    return (rows || []).map(row => ({
      ...row,
      contact_name: "",
      contact_phone: ""
    }));
  }

  // إنشاء العرض دون إعادة بيانات صاحب العرض إلى المتصفح.
  async function createOffer(offer) {
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
      verification_status: "pending",
      developer_approval_status: "unknown",
      status: "available"
    };

    // لا نطلب إرجاع الصف الذي يحتوي على بيانات التواصل.
    await request("property_offers", {
      method: "POST",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    });

    // نتيجة عامة مؤقتة؛ يُعاد تحميل العرض من قائمة العروض العامة.
    return {
      ...payload,
      id: null,
      contact_name: "",
      contact_phone: "",
      status: "available",
      created_at: new Date().toISOString()
    };
  }

  window.LAYAN_SUPABASE = {
    getOffers,
    uploadImages,
    createOffer
  };

  console.log("LAYAN: تم تجهيز الاتصال.");
})();
