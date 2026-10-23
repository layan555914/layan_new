
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
        area: offer.area || null,
        property_type: offer.property_type,
        description: offer.description || null,
        total_price: Number(offer.total_price || 0),
        down_payment: Number(offer.down_payment || 0),
        paid_amount: Number(offer.paid_amount || 0),
        remaining_installments: Number(
          offer.remaining_installments || 0
        ),
        transfer_fee: Number(offer.transfer_fee || 0),
        discount_percent: Number(offer.discount_percent || 0)
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

  console.log("LAYAN: تم تجهيز الاتصال بـ Supabase.");
})();

