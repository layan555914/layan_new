
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
        governorate: "أسيوط",
        city: offer.city || "أسيوط",
        area: offer.area || null,
        property_type: offer.property_type || "شقة",
        total_price: Number(offer.total_price || 0),
        paid_amount: Number(offer.paid_amount || 0),
        remaining_amount: Number(
          offer.remaining_amount ??
          offer.remaining_installments ??
          0
        ),
        assignment_fee: Number(
          offer.assignment_fee ??
          offer.transfer_fee ??
          0
        ),
        discount_amount: Number(
          offer.discount_amount ??
          offer.discount_amount ??
          0
        ),
        description: offer.description || null,
        image_urls: Array.isArray(offer.image_urls)
          ? offer.image_urls
          : []
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
