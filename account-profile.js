// ASYUT AQAR — optional completion reminder after email + OTP account access.
(() => {
  "use strict";
  if (window.__asyutAccountProfile) return;
  window.__asyutAccountProfile = true;

  const FIRST_REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;
  const REMIND_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
  const KEY_PREFIX = "asyutAqarProfileReminder:";
  const NEW_ACCOUNT_KEY_PREFIX = "asyutAqarNewAccount:";
  const TYPE_OPTIONS = [["seeker","باحث عن عقار"],["owner","مالك عقار"],["broker","وسيط عقاري"],["company","شركة عقارية"]];
  let dialog = null;
  const styles = `
    .asyut-profile-reminder{width:min(94vw,470px);max-height:88vh;overflow:auto;border:1px solid #e6dfd5;border-radius:18px;padding:0;background:#fff;color:#262626;box-shadow:0 22px 65px #0003;font-family:inherit}
    .asyut-profile-reminder::backdrop{background:#17212bcc}
    .asyut-profile-reminder__inner{padding:22px;display:grid;gap:14px}
    .asyut-profile-reminder h2{margin:0;font-size:21px}
    .asyut-profile-reminder p{margin:0;line-height:1.8;color:#626262}
    .asyut-profile-reminder__actions{display:flex;gap:10px;flex-wrap:wrap}
    .asyut-profile-reminder__actions button{min-height:44px;flex:1 1 140px;border-radius:10px;padding:10px 14px;font:inherit;font-weight:700;cursor:pointer}
    .asyut-profile-reminder__primary{border:0;background:#b77d32;color:#fff}
    .asyut-profile-reminder__secondary{border:1px solid #d8d0c4;background:#fff;color:#4c4c4c}
    .asyut-profile-reminder form{display:grid;gap:12px}
    .asyut-profile-reminder label{display:grid;gap:6px;font-weight:700}
    .asyut-profile-reminder input,.asyut-profile-reminder select{width:100%;min-height:44px;border:1px solid #d7d1c8;border-radius:9px;padding:9px 11px;font:inherit;background:#fff}
    .asyut-profile-reminder [role=status]{min-height:1.4em;font-size:13px}
  `;
  function userFromSession() {
    try { return window.LAYAN_SUPABASE?.getSession?.()?.user || null; } catch (_) { return null; }
  }
  function profileComplete(user) {
    const data = user?.user_metadata || {};
    return Boolean(String(data.full_name || "").trim() && String(data.phone || "").trim() && String(data.account_type || "").trim());
  }
  function reminderKey(userId) { return KEY_PREFIX + userId; }
  function wasRemindedRecently(userId) {
    try {
      const last = Number(localStorage.getItem(reminderKey(userId)) || 0);
      return last > 0 && Date.now() - last < REMIND_AGAIN_AFTER_MS;
    } catch (_) { return false; }
  }
  function remindLater(userId) {
    try { localStorage.setItem(reminderKey(userId), String(Date.now())); } catch (_) {}
    dialog?.close();
  }
  function ensureDialog() {
    if (dialog) return dialog;
    if (!document.getElementById("asyutProfileReminderStyles")) {
      const style = document.createElement("style");
      style.id = "asyutProfileReminderStyles";
      style.textContent = styles;
      document.head.appendChild(style);
    }
    dialog = document.createElement("dialog");
    dialog.id = "asyutProfileReminder";
    dialog.className = "asyut-profile-reminder";
    dialog.innerHTML = `
      <div class="asyut-profile-reminder__inner">
        <section id="asyutProfilePrompt">
          <h2>استكمل بيانات حسابك</h2>
          <p>تقدر تكمل الاسم ورقم الموبايل ونوع الحساب لاحقًا. استكمال البيانات اختياري، ومش شرط لتصفح المنصة.</p>
          <div class="asyut-profile-reminder__actions">
            <button type="button" class="asyut-profile-reminder__primary" id="asyutProfileStart">استكمال البيانات</button>
            <button type="button" class="asyut-profile-reminder__secondary" id="asyutProfileLater">لاحقًا</button>
          </div>
        </section>
        <form id="asyutProfileForm" hidden>
          <h2>استكمال بيانات الحساب</h2>
          <label>الاسم الكامل<input id="asyutProfileName" name="full_name" type="text" maxlength="80" autocomplete="name" required></label>
          <label>رقم الموبايل<input id="asyutProfilePhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" maxlength="13" placeholder="01012345678" required></label>
          <label>نوع الحساب<select id="asyutProfileType" name="account_type" required><option value="">اختر نوع الحساب</option>${TYPE_OPTIONS.map(([value,label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
          <p id="asyutProfileStatus" role="status" aria-live="polite"></p>
          <div class="asyut-profile-reminder__actions">
            <button type="submit" class="asyut-profile-reminder__primary" id="asyutProfileSave">حفظ البيانات</button>
            <button type="button" class="asyut-profile-reminder__secondary" id="asyutProfileLaterFromForm">لاحقًا</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("#asyutProfileStart").addEventListener("click", () => {
      const data = userFromSession()?.user_metadata || {};
      dialog.querySelector("#asyutProfileName").value = data.full_name || "";
      dialog.querySelector("#asyutProfilePhone").value = data.phone || "";
      dialog.querySelector("#asyutProfileType").value = data.account_type || "";
      dialog.querySelector("#asyutProfilePrompt").hidden = true;
      dialog.querySelector("#asyutProfileForm").hidden = false;
      dialog.querySelector("#asyutProfileName").focus();
    });
    const later = () => {
      const user = userFromSession();
      if (user?.id) remindLater(user.id); else dialog.close();
    };
    dialog.querySelector("#asyutProfileLater").addEventListener("click", later);
    dialog.querySelector("#asyutProfileLaterFromForm").addEventListener("click", later);
    dialog.addEventListener("cancel", event => { event.preventDefault(); later(); });
    dialog.addEventListener("click", event => { if (event.target === dialog) later(); });
    dialog.querySelector("#asyutProfileForm").addEventListener("submit", async event => {
      event.preventDefault();
      const user = userFromSession();
      const name = dialog.querySelector("#asyutProfileName").value.trim().replace(/\s+/g, " ");
      const phone = dialog.querySelector("#asyutProfilePhone").value.replace(/[^0-9]/g, "");
      const type = dialog.querySelector("#asyutProfileType").value;
      const status = dialog.querySelector("#asyutProfileStatus");
      const save = dialog.querySelector("#asyutProfileSave");
      if (!user?.id) { status.textContent = "انتهت جلسة الدخول. سجّل الدخول بالكود ثم حاول مرة أخرى."; return; }
      if (name.length < 3) { status.textContent = "اكتب الاسم كاملًا."; return; }
      if (!/^01[0125][0-9]{8}$/.test(phone)) { status.textContent = "اكتب رقم موبايل مصري صحيح."; return; }
      if (!TYPE_OPTIONS.some(([value]) => value === type)) { status.textContent = "اختر نوع الحساب."; return; }
      const api = window.LAYAN_SUPABASE;
      if (!api?.updateUserMetadata) { status.textContent = "خدمة حفظ بيانات الحساب غير متاحة الآن."; return; }
      save.disabled = true;
      status.textContent = "جارٍ حفظ البيانات...";
      try {
        await api.updateUserMetadata({ full_name: name, phone, account_type: type });
        try { localStorage.removeItem(reminderKey(user.id)); } catch (_) {}
        try { localStorage.removeItem(NEW_ACCOUNT_KEY_PREFIX + user.id); } catch (_) {}
        status.textContent = "تم حفظ بيانات حسابك بنجاح.";
        dialog.close();
      } catch (error) {
        status.textContent = error?.message || "تعذر حفظ البيانات. حاول مرة أخرى.";
      } finally { save.disabled = false; }
    });
    return dialog;
  }
  function checkAndRemind() {
    const user = userFromSession();
    if (!user?.id || profileComplete(user) || wasRemindedRecently(user.id)) return;
    let createdAt = 0;
    try { createdAt = Number(localStorage.getItem(NEW_ACCOUNT_KEY_PREFIX + user.id) || 0); } catch (_) {}
    // Only accounts created through the new email-OTP signup are eligible for this optional reminder.
    // Legacy users are intentionally left undisturbed.
    if (!createdAt || !Number.isFinite(createdAt) || Date.now() - createdAt < FIRST_REMINDER_AFTER_MS) return;
    const modal = ensureDialog();
    if (!modal.open) window.setTimeout(() => {
      const latest = userFromSession();
      if (latest?.id === user.id && !profileComplete(latest) && !wasRemindedRecently(latest.id)) modal.showModal();
    }, 500);
  }
  window.addEventListener("layan-auth-state-changed", checkAndRemind);
  window.addEventListener("layan:auth-ready", checkAndRemind);
  window.addEventListener("focus", checkAndRemind);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkAndRemind, { once: true });
  else window.setTimeout(checkAndRemind, 900);
})();