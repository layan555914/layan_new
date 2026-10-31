document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("layanAiForm");
  if (!form) return;
  const input = document.getElementById("layanAiPrompt");
  const answer = document.getElementById("layanAiAnswer");
  const send = document.getElementById("layanAiSend");
  const tabs = [...document.querySelectorAll("[data-ai-mode]")];
  let mode = "search";
  tabs.forEach(tab => tab.addEventListener("click", () => {
    mode = tab.dataset.aiMode === "admin" ? "admin" : "search";
    tabs.forEach(item => item.setAttribute("aria-pressed", String(item === tab)));
    input.placeholder = mode === "admin" ? "اكتب سؤالًا عن تشغيل المنصة أو مراجعة الطلبات..." : "مثال: عايز شقة في أسيوط بمقدم أقل من 300 ألف...";
    answer.textContent = "";
  }));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) { input.focus(); return; }
    const api = window.LAYAN_SUPABASE;
    const session = api?.getSession?.();
    if (!session?.access_token) {
      answer.className = "layan-ai-answer layan-ai-error";
      answer.textContent = "سجّل الدخول أولًا لاستخدام مساعد أسيوط عقار.";
      document.getElementById("loginBtn")?.click();
      return;
    }
    send.disabled = true;
    send.textContent = "جاري التفكير...";
    answer.className = "layan-ai-answer layan-ai-loading";
    answer.textContent = "جارٍ تجهيز الرد...";
    try {
      const config = window.LAYAN_CONFIG;
      const response = await fetch(config.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/layan-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: config.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ message, mode })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "تعذر الحصول على رد.");
      answer.className = "layan-ai-answer";
      answer.textContent = data.answer;
    } catch (error) {
      answer.className = "layan-ai-answer layan-ai-error";
      answer.textContent = error.message || "حدث خطأ مؤقت. حاول مرة أخرى.";
    } finally {
      send.disabled = false;
      send.textContent = "اسأل أسيوط عقار";
    }
  });
});