import { test, expect } from "@playwright/test";

const SUPABASE = "https://asyut-aqar-test.supabase.co";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AREA_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function installDashboardMocks(page, role = "owner") {
  let savedRequests = [];
  let submittedBody = null;

  await page.route("**/config.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_CONFIG = { SUPABASE_URL: "' + SUPABASE + '", SUPABASE_PUBLISHABLE_KEY: "test-key" };'
  }));
  await page.route("**/gubabase.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_SUPABASE = { requireAuthenticated: async () => ({ user: { id: "' + USER_ID + '" } }), authedFetch: (url, options) => fetch(url, options) };'
  }));

  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/", "");
    const json = (data, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data)
    });

    if (path === "rpc/layan_company_owner_profile") return json(null);
    if (path === "company_entity_managers") {
      return json(role === "owner" ? [{ directory_entity_id: ENTITY_ID, verified_at: "2026-11-17T10:00:00Z" }] : []);
    }
    if (path === "company_entity_manager_members") {
      return json(role === "manager" || role === "editor"
        ? [{ directory_entity_id: ENTITY_ID, member_role: role }]
        : []);
    }
    if (path === "company_profile_manager_members") return json([]);
    if (path === "property_offers") return json([]);
    if (path === "company_claim_requests") return json([]);
    if (path === "company_entity_profile_update_requests") return json([]);
    if (path === "directory_entities") {
      return json([{
        id: ENTITY_ID,
        name_ar: "شركة أسيوط التجريبية",
        entity_type: "developer",
        description: "ملف شركة منشور",
        public_visible: true,
        verification_status: "published"
      }]);
    }
    if (path === "directory_project_entities") return json([]);
    if (path === "directory_projects") {
      return json([{
        id: PROJECT_ID,
        name_ar: "مشروع منشور للاختبار",
        project_type: "residential",
        public_visible: true,
        verification_status: "published"
      }]);
    }
    if (path === "directory_areas") {
      return json([{
        id: AREA_ID,
        name_ar: "مدينة أسيوط",
        is_active: true,
        public_visible: true,
        verification_status: "published"
      }]);
    }
    if (path === "rpc/company_project_request_submit") {
      submittedBody = route.request().postDataJSON();
      savedRequests = [{
        request_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        directory_entity_id: ENTITY_ID,
        entity_name: "شركة أسيوط التجريبية",
        request_type: submittedBody.p_request_type,
        project_id: submittedBody.p_project_id,
        project_name: submittedBody.p_project_payload?.name_ar || "مشروع منشور للاختبار",
        requested_relation_type: submittedBody.p_relation_type,
        status: "pending",
        created_at: "2026-11-18T00:00:00Z"
      }];
      return json("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    }
    if (path === "rpc/company_project_requests_mine") return json(savedRequests);
    return json([]);
  });

  return {
    getSubmittedBody: () => submittedBody,
    setRole: nextRole => { role = nextRole; }
  };
}

test("verified company owner can submit a new project for review without publishing it", async ({ page }) => {
  const mocks = await installDashboardMocks(page, "owner");
  await page.goto("/company-dashboard.html");

  const forms = page.locator("#cdProjectManagementRoot .cd-project-request-form");
  await expect(forms).toHaveCount(2);

  const form = forms.nth(0);
  await form.getByLabel("ملف الشركة المخوّل").selectOption(ENTITY_ID);
  await form.getByLabel(/اسم المشروع بالعربية/).fill("مشروع اختبار جديد");
  await form.getByLabel(/نوع المشروع/).selectOption("residential");
  await form.getByLabel("المنطقة").selectOption(AREA_ID);
  await form.getByLabel("صفة الشركة داخل المشروع").selectOption("developer");
  await form.getByLabel("رابط عام يثبت العلاقة (اختياري)").fill("https://example.com/project");
  await form.locator('button[type="submit"]').click();

  await expect(page.locator("#cdProjectRequestsList")).toContainText("مشروع اختبار جديد");
  await expect(page.locator("#cdProjectRequestsList")).toContainText("قيد مراجعة الإدارة");
  const body = mocks.getSubmittedBody();
  expect(body.p_request_type).toBe("new_project");
  expect(body.p_directory_entity_id).toBe(ENTITY_ID);
  expect(body.p_project_payload.name_ar).toBe("مشروع اختبار جديد");
  expect(body.p_project_payload.public_visible).toBeUndefined();
  expect(body.p_relation_type).toBe("developer");
});

test("verified manager can submit a project request, but an editor cannot", async ({ page }) => {
  const managerMocks = await installDashboardMocks(page, "manager");
  await page.goto("/company-dashboard.html");
  const forms = page.locator("#cdProjectManagementRoot .cd-project-request-form");
  await expect(forms).toHaveCount(2);

  const linkForm = forms.nth(1);
  await linkForm.getByLabel("ملف الشركة المخوّل").selectOption(ENTITY_ID);
  await linkForm.getByLabel("المشروع المنشور").selectOption(PROJECT_ID);
  await linkForm.getByLabel("صفة الشركة داخل المشروع").selectOption("marketing_agent");
  await linkForm.getByLabel("وصف دليل العلاقة (مطلوب عند عدم وجود رابط)").fill("تفويض الشركة بتسويق المشروع");
  await linkForm.locator('button[type="submit"]').click();
  await expect(page.locator("#cdProjectRequestsList")).toContainText("طلب ربط بمشروع منشور");
  expect(managerMocks.getSubmittedBody().p_request_type).toBe("link_project");

  // Run the editor permission check in a fresh context so it has no
  // persisted session, cached script, or service-worker state from the manager.
  const editorContext = await page.context().browser().newContext({ serviceWorkers: "block" });
  const editorPage = await editorContext.newPage();
  try {
    await installDashboardMocks(editorPage, "editor");
    const editorUrl = new URL("/company-dashboard.html", page.url()).href;
    await editorPage.goto(editorUrl);
    await expect(editorPage.locator("#cdProjectManagementRoot")).toContainText("إرسال طلبات المشروعات متاح للمالك المعتمد أو مدير الملف المفوض فقط");
    await expect(editorPage.locator("#cdProjectManagementRoot .cd-project-request-form")).toHaveCount(0);
  } finally {
    await editorContext.close();
  }
});

test("directory administrator can approve a company request and see its final state", async ({ page }) => {
  let currentRequest = {
    request_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    directory_entity_id: ENTITY_ID,
    entity_name: "شركة أسيوط التجريبية",
    requester_user_id: USER_ID,
    requester_role: "owner",
    request_type: "new_project",
    project_id: null,
    project_name: "مشروع جديد بانتظار المراجعة",
    project_payload: {
      name_ar: "مشروع جديد بانتظار المراجعة",
      project_type: "residential",
      project_status: "unknown",
      description: "بيانات أولية من الشركة"
    },
    requested_relation_type: "developer",
    evidence_url: "https://example.com/evidence",
    evidence_description: null,
    status: "pending",
    admin_notes: null,
    created_at: "2026-11-18T00:00:00Z"
  };

  await page.route("**/config.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'window.LAYAN_CONFIG = { SUPABASE_URL: "' + SUPABASE + '", SUPABASE_PUBLISHABLE_KEY: "test-key" };'
  }));
  await page.route("**/gubabase.js*", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: 'let testSession = null; window.LAYAN_SUPABASE = { getSession: () => testSession, signIn: async () => { testSession = { access_token: "test-access-token", expires_at: Math.floor(Date.now()/1000)+3600 }; }, signOut: async () => { testSession = null; } };'
  }));
  await page.route(SUPABASE + "/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/rest/v1/", "");
    const json = data => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data)
    });
    if (path === "rpc/layan_is_admin") return json(true);
    if (path === "rpc/company_project_request_admin_list") return json([currentRequest]);
    if (path === "rpc/company_project_request_admin_review") {
      const body = route.request().postDataJSON();
      expect(body.p_action).toBe("approve");
      currentRequest = { ...currentRequest, status: "approved", resulting_project_id: PROJECT_ID };
      return json(PROJECT_ID);
    }
    return json([]);
  });

  await page.goto("/company-project-requests-admin.html");
  await page.locator("#cprEmail").fill("admin@example.com");
  await page.locator("#cprPassword").fill("valid-password");
  await page.locator("#cprLoginForm button[type=submit]").click();

  await expect(page.locator("#cprRequestsList")).toContainText("مشروع جديد بانتظار المراجعة");
  // The review UI intentionally asks for confirmation before making the decision.
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#cprRequestsList button").filter({ hasText: "اعتماد وإنشاء سجل داخلي" }).click();
  await expect(page.locator("#cprStatus")).toContainText("تم اعتماد الطلب");
  await expect(page.locator("#cprRequestsList")).toContainText("تم الاعتماد");
  await expect(page.locator("#cprRequestsList")).toContainText("لا يزال غير منشور");
});
