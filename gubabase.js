(function () {
  const config = window.LAYAN_CONFIG;

  if (!config || !config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    console.error("LAYAN: إعدادات Supabase غير مكتملة.");
    return;
  }

  window.LAYAN_SUPABASE = {
    url: config.SUPABASE_URL,
    key: config.SUPABASE_PUBLISHABLE_KEY,

    async getOffers() {
      const response = await fetch(
        `${this.url}/rest/v1/property_offers?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("تعذر تحميل العروض: " + await response.text());
      }

      return response.json();
    }
  };
})();
