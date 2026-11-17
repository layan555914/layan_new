import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_PROFILE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_COMPANY_PROFILE_ID = "abababab-abab-4bab-8bab-abababababab";
const ENTITY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROJECT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function installDashboardMocks(page, scenario = "populated") {
  await page.route("**/config.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_CONFIG = { SUPABASE_URL: "' + SUPABASE + '", SUPABASE_PUBLISHABLE_KEY: "test-publishable-key", ENVIRONMENT: "test" };'
  }));

  const authBody = scenario === "unauthenticated"
    ? 'window.LAYAN_SUPABASE = { requireAuthenticated: async () => { throw new Error("سجّل الدخول أولًا قبل فتح مساحة الشركة."); }, authedFetch: (url, options) => fetch(url, options) };'
    : 'window.LAYAN_SUPABASE = { requireAuthenticated: async () => ({ user: { id: "' + USER_ID + '" } }), authedFetch: (url, options) => fetch(url, options) };';
  await page.route("**/gubabase.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: authBody
  }));

  let companyMembers = [
    { member_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", user_id: "ffffffff-ffff-4fff-8fff-ffffffffffff", email: "staff@company.test", member_role: "editor" }
  ];
  let entityMembers = [
    { member_id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222", email: "sales@agency.test", member_role: "manager" }
  ];

  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/", "");
    const empty = [];
    const json = async (data, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data)
    });

    if (scenario === "empty") {
      if (path === "rpc/layan_company_owner_profile") return json(null);
      return json(empty);
    }

    if (path === "rpc/layan_company_owner_profile") {
      return json({
        id: COMPANY_PROFILE_ID,
        company_name: "شركة أسيوط للاختبار",
        category: "شركات التطوير العقاري",
        city: "أسيوط",
        description: "ملف شركة تجريبي لاختبار لوحة الإدارة.",
        logo_url: null,
        status: "active",
        verified_at: "2026-11-17T10:00:00Z",
        projects: [{ title: "سابقة أعمال", description: "وصف معلوماتي وليس مشروعًا مستقلاً." }]
      });
    }
    if (path === "company_entity_managers") {
      return json([{ directory_entity_id: ENTITY_ID, verified_at: "2026-11-17T10:00:00Z", representative_role: "المالك" }]);
    }
    if (path === "company_entity_manager_members") {
      return json(empty);
    }
    if (path === "company_profile_manager_members") {
      return json([{ company_profile_id: MEMBER_COMPANY_PROFILE_ID, member_role: "editor" }]);
    }
    if (path === "property_offers") {
      return json([
        { id: 701, title: "شقة اختبار للبيع", status: "available", listing_purpose: "بيع" },
        { id: 702, title: "محل اختبار للتنازل", status: "pending", listing_purpose: "تنازل" }
      ]);
    }
    if (path === "company_claim_requests") {
      return json([{
        id: "77777777-7777-4777-8777-777777777777",
        directory_entity_id: ENTITY_ID,
        status: "pending",
        admin_notes: null,
        created_at: "2026-11-17T11:00:00Z"
      }]);
    }
    if (path === "company_entity_profile_update_requests") {
      return json([{
        id: "88888888-8888-4888-8888-888888888888",
        directory_entity_id: ENTITY_ID,
        status: "needs_changes",
        admin_notes: "يرجى استكمال بيانات العنوان.",
        created_at: "2026-11-17T12:00:00Z"
      }]);
    }
    if (path === "directory_entities") {
      return json([{
        id: ENTITY_ID,
        name_ar: "وكالة أسيوط للتسويق",
        entity_type: "marketing",
        service_category: "real_estate_marketing",
        description: "ملف منشور لشركة تسويق.",
        public_logo_url: null,
        public_address: "أسيوط",
        public_visible: true,
        verification_status: "published"
      }]);
    }
    if (path === "directory_project_entities") {
      return json([{ project_id: PROJECT_ID, relation_type: "marketing_agent" }]);
    }
    if (path === "directory_projects") {
      return json([{
        id: PROJECT_ID,
        slug: "test-project",
        name_ar: "مشروع تجريبي مستقل",
        project_type: "residential",
        project_status: "under_construction",
        public_visible: true,
        verification_status: "published"
      }]);
    }
    if (path === "company_profiles_public") {
      return json([{
        id: MEMBER_COMPANY_PROFILE_ID,
        company_name: "شركة عضو مفوض",
        category: "شركات التسويق العقاري",
        city: "أسيوط",
        logo_url: null,
        representative_verified_at: "2026-11-17T10:00:00Z"
      }]);
    }

    if (path === "rpc/company_profile_manager_member_list") return json(companyMembers);
    if (path === "rpc/company_entity_manager_member_list") return json(entityMembers);
    if (path === "rpc/company_profile_manager_invite") {
      const body = route.request().postDataJSON();
      companyMembers = companyMembers.concat({
        member_id: "33333333-3333-4333-8333-333333333333",
        user_id: "44444444-4444-4444-8444-444444444444",
        email: body.p_email,
        member_role: body.p_role
      });
      return json("33333333-3333-4333-8333-333333333333");
    }
    if (path === "rpc/company_entity_manager_invite") {
      const body = route.request().postDataJSON();
      entityMembers = entityMembers.concat({
        member_id: "55555555-5555-4555-8555-555555555555",
        user_id: "66666666-6666-4666-8666-666666666666",
        email: body.p_email,
        member_role: body.p_role
      });
      return json("55555555-5555-4555-8555-555555555555");
    }
    if (path.endsWith("_revoke")) return json(true);
    return json(empty);
  });
}

test("dashboard displays only current account profiles, published project links and account-owned listings", async ({ page }) => {
  await installDashboardMocks(page);
  await page.goto("/company-dashboard.html");

  await expect(page.locator("#cdConnectionMessage")).toContainText("تم تحميل ملفاتك");
  await expect(page.locator("#cdCompanyProfiles")).toContainText("شركة أسيوط للاختبار");
  await expect(page.locator("#cdCompanyProfiles")).toContainText("وكالة أسيوط للتسويق");
  await expect(page.locator("#cdCompanyProfiles")).toContainText("شركة عضو مفوض");
  await expect(page.locator("#cdCountProfiles")).toHaveText("3");
  await expect(page.locator("#cdCountProjects")).toHaveText("1");
  await expect(page.locator("#cdCountListings")).toHaveText("2");
  await expect(page.locator("#cdCountReviews")).toHaveText("3");
  await expect(page.locator("#cdProjectsList")).toContainText("مشروع تجريبي مستقل");
  await expect(page.locator("#cdProjectsList")).toContainText("وكيل تسويق");
  await expect(page.locator("#cdProjectsList a")).toHaveAttribute("href", "./project.html?id=" + PROJECT_ID);
  await expect(page.locator("#cdListingsList")).toContainText("شقة اختبار للبيع");
  await expect(page.locator("#cdListingsList")).toContainText("محل اختبار للتنازل");
  await expect(page.locator("#cdRequestsList")).toContainText("طلب استلام ملف شركة");
  await expect(page.locator("#cdRequestsList")).toContainText("قيد مراجعة الإدارة");
  await expect(page.locator("#cdRequestsList")).toContainText("يرجى استكمال بيانات العنوان.");
  await expect(page.locator("#cdCompanyProfiles")).toContainText("أعمال سابقة مدخلة في ملف الشركة");
  await expect(page.locator("#cdCompanyProfiles")).toContainText("ليست سجلات مشروعات مستقلة");
});

test("verified profile owners can invite a team member through existing RPC controls", async ({ page }) => {
  await installDashboardMocks(page);
  await page.goto("/company-dashboard.html");
  // The dashboard has its own section navigation; do not mount the global fixed bottom app bar.
  await expect(page.locator(".mobile-nav")).toHaveCount(0);

  const forms = page.locator(".cd-team-form");
  await expect(forms).toHaveCount(2);

  const companyForm = forms.nth(0);
  await companyForm.locator('input[name="email"]').fill("new.editor@company.test");
  await companyForm.locator('select[name="role"]').selectOption("editor");
  // Center the control in the viewport so the fixed app bar and floating helpers
  // cannot cover its tap target on a phone-sized screen.
  const companySubmit = companyForm.locator('button[type="submit"]');
  await companySubmit.scrollIntoViewIfNeeded();
  await expect(companySubmit).toBeVisible();
  const hitTest = await companySubmit.evaluate(button => {
    const rect = button.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
    const target = document.elementFromPoint(x, y);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      button: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      hitTarget: target ? target.tagName + (target.id ? "#" + target.id : "") + (target.className && typeof target.className === "string" ? "." + target.className.trim().replace(/\\s+/g, ".") : "") : null,
      bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
      htmlPointerEvents: getComputedStyle(document.documentElement).pointerEvents
    };
  });
  console.log("[company-dashboard team button hit test]", JSON.stringify(hitTest));
  await companySubmit.click({ timeout: 12000 });
  await expect(page.locator("#cdCompanyProfiles")).toContainText("new.editor@company.test");

  const entityForm = page.locator(".cd-team-form").nth(1);
  await entityForm.locator('input[name="email"]').fill("new.manager@agency.test");
  await entityForm.locator('select[name="role"]').selectOption("manager");
  const entitySubmit = entityForm.locator('button[type="submit"]');
  await entitySubmit.evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  await expect(entitySubmit).toBeVisible();
  await entitySubmit.click({ timeout: 12000 });
  await expect(page.locator("#cdCompanyProfiles")).toContainText("new.manager@agency.test");
});

test("accounts without company profiles receive a clear registration and claim path", async ({ page }) => {
  await installDashboardMocks(page, "empty");
  await page.goto("/company-dashboard.html");

  await expect(page.locator("#cdCompanyProfiles")).toContainText("لا يوجد ملف شركة مرتبط بحسابك");
  await expect(page.locator("#cdCompanyProfiles a")).toHaveAttribute("href", "./companies.html");
});

test("unauthenticated visitors are directed to the platform login entry", async ({ page }) => {
  await installDashboardMocks(page, "unauthenticated");
  await page.goto("/company-dashboard.html");

  await expect(page.locator("#cdConnectionMessage")).toContainText("سجّل الدخول");
  await expect(page.locator("#cdCompanyProfiles a")).toHaveAttribute("href", "./");
});
