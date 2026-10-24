
(function () {
  const config = window.LAYAN_CONFIG;

  if (!config?.SUPABASE_URL || !config?.SUPABASE_PUBLISHABLE_KEY) {
    console.error("LAYAN: إعدادات Supabase غير مكتملة.");
    return;
  }

  const url = config.SUPABASE_URL.replace(/\/$/, "");
  const key = config.SUPABASE_PUBLISHABLE_KEY;

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
      throw new Error(await response.text());
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  window.LAYAN_SUPABASE = {
    async getOffers() {
      return request(
        "property_offers?select=*&order=created_at.desc"
      );
    },

    async createOffer(offer) {
      const payload = {
        title: offer.title,
        governorate: offer.governorate || "أسيوط",
        city: offer.city || "أسيوط",
        area: offer.area || null,
        property_type: offer.property_type || "شقة",
        bedrooms: Number(offer.bedrooms || 0),
        bathrooms: Number(offer.bathrooms || 0),
        area_m2: Number(offer.area_m2 || 0),
        total_price: Number(offer.total_price || 0),
        paid_amount: Number(offer.paid_amount || 0),
        remaining_amount: Number(
          offer.remaining_amount ??
          offer.remaining_installments ?? 0
        ),
        monthly_installment: Number(
          offer.monthly_installment || 0
        ),
        assignment_fee: Number(
          offer.assignment_fee ?? offer.transfer_fee ?? 0
        ),
        assignment_fee_percentage: Number(
          offer.assignment_fee_percentage || 0
        ),
        discount_amount: Number(offer.discount_amount || 0),
        description: offer.description || null,
        image_urls: Array.isArray(offer.image_urls)
          ? offer.image_urls
          : [],
        developer_name: offer.developer_name || null,
        contact_name: offer.contact_name || null,
        contact_phone: offer.contact_phone || null,
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

  console.log("LAYAN: تم تجهيز الاتصال بقاعدة البيانات.");
})();
