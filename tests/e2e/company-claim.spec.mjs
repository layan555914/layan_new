import { test, expect } from "@playwright/test";

const SUPABASE = "https://wisnmlbefdrkcbbqvdlg.supabase.co";
const ENTITY_ID = "c1111111-1111-4111-8111-111111111301";
const USER_ID = "f7f77640-ae97-4722-8adb-5a88191eb1c3";
const USER = {
  id: USER_ID,
  email: "company-claim-test@example.invalid",
  email_confirmed_at: "2026-11-01T00:00:00Z",
  app_metadata: {},
  user_metadata: {}
};

const SESSION = {
  access_token: "company-claim-e2e-access-token",
  refresh_token: "company-claim-e2e-refresh-token",
  token_type: "bearer",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: USER
};

const ENTITY = {
  id: ENTITY_ID,
  name_ar: "شركة اختبار طلب استلام الملف",
  name_en: "Company Claim Test",
  entity_type: "developer",
  description: "سجل شركة تجريبي لاختبار طلب استلام الملف.",
  website_url: null,
  public_phone: "01012345678",
  public_email: null,
  public_address: "أسيوط - للاختبار",
  primary_area_id: null,
  verification_status: "published",
  public_visible: true
};

const CLAIM = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  directory_entity_id: ENTITY_ID,
  company_name: ENTITY.name_ar,
  requester_user_id: USER_ID,
  representative_name: "ممثل الشركة التجريبي",
  representative_role: "مدير الشركة",
  contact_phone: "01012345678",
  contact_email: "company-claim-test@example.invalid",
  notes: "طلب تجريبي من اختبار Playwright",
  status: "pending",
  admin_notes: null,
  created_at: "2026-11-13T17:00:00Z",
  reviewed_at: null,
  reviewed_by: null
};

const reply = (route, body, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  body: JSON.stringify(body)
});

async function seedAuthenticatedSession(page) {
  await page.addInitScript(session => {
    sessionStorage.setItem("layanSupabaseSession", JSON.stringify(session));
  }, SESSION);
}

async function mockCompanyClaimBackend(page, options = {}) {
  const entity = options.entity || ENTITY;
  const state = {
    claims: options.claims ? [structuredClone(options.claims)] : [],
    submissions: [],
    reviews: []
  };

  await page.route(SUPABASE + "/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/auth/v1/user") return reply(route, USER);
    if (path.startsWith("/auth/v1/")) return reply(route, {});

    if (path === "/rest/v1/directory_entities") return reply(route, [entity]);
    if (path === "/rest/v1/directory_entity_sources") return reply(route, []);

    if (path === "/rest/v1/company_claim_requests") {
      if (method === "POST") {
        const payload = request.postDataJSON();
        state.submissions.push(payload);
        const row = {
          ...CLAIM,
          ...payload,
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          status: "pending",
          created_at: new Date().toISOString()
        };
        state.claims = [row];
        return reply(route, [row], 201);
      }
      return reply(route, state.claims.filter(row =>
        url.searchParams.get("directory_entity_id") === "eq." + row.directory_entity_id &&
        url.searchParams.get("requester_user_id") === "eq." + row.requester_user_id
      ));
    }

    if (path.startsWith("/rest/v1/rpc/")) {
      const rpc = path.split("/").pop();
      if (rpc === "layan_is_admin") return reply(route, true);
      if (rpc === "company_claim_admin_list") return reply(route, state.claims.filter(row => row.status === "pending"));
      if (rpc === "company_claim_admin_review") {
        const payload = request.postDataJSON();
        state.reviews.push(payload);
        if (payload.p_action === "approve") state.claims = state.claims.map(row =>
          row.id === payload.p_id ? { ...row, status: "approved" } : row
        );
        if (payload.p_action === "reject") state.claims = state.claims.map(row =>
          row.id === payload.p_id ? { ...row, status: "rejected" } : row
        );
        return reply(route, payload.p_action === "approve" ? "approved" :
          payload.p_action === "request_info" ? "info_requested" : "rejected");
      }
      return reply(route, []);
    }

    if (method === "GET") return reply(route, []);
    if (method === "POST") return reply(route, [], 201);
    return route.fulfill({ status: 204, body: "" });
  });

  return state;
}

async function fillClaimForm(page, role = "مدير النشاط") {
  const form = page.locator("#companyClaimForm");
  await form.locator("[name='representative_name']").fill("ممثل الشركة التجريبي");
  await form.locator("[name='representative_role']").selectOption({ label: role });
  await form.locator("[name='representative_phone']").fill("01012345678");
  await form.locator("[name='representative_email']").fill("company-claim-test@example.invalid");
  await form.locator("[name='representative_notes']").fill("طلب تجريبي من اختبار Playwright");
  return form;
}

test("anonymous visitors can open the claim form but cannot submit a company claim", async ({ page }) => {
  const state = await mockCompanyClaimBackend(page);

  await page.goto("/company.html?entity_id=" + ENTITY_ID);
  await expect(page.locator("#companyProfileRoot h1")).toHaveText(ENTITY.name_ar);
  await page.locator("#companyClaimOpen").click();

  const form = await fillClaimForm(page);
  await form.locator("button[type='submit']").click();

  await expect(page.locator("#companyClaimStatus")).toContainText("سجّل الدخول أولًا");
  await expect(page.locator("#companyClaimLoginLink")).toBeVisible();
  expect(state.submissions).toHaveLength(0);
});

test("an authenticated representative submits a claim linked to their Supabase account", async ({ page }) => {
  await seedAuthenticatedSession(page);
  const state = await mockCompanyClaimBackend(page);

  await page.goto("/company.html?entity_id=" + ENTITY_ID);
  await page.locator("#companyClaimOpen").click();

  const form = await fillClaimForm(page);
  await form.locator("button[type='submit']").click();

  await expect(page.locator("#companyClaimStatus")).toContainText("قيد المراجعة");
  await expect(form).toBeHidden();

  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0]).toMatchObject({
    directory_entity_id: ENTITY_ID,
    requester_user_id: USER_ID,
    representative_name: "ممثل الشركة التجريبي",
    representative_role: "مدير النشاط",
    contact_phone: "01012345678",
    contact_email: "company-claim-test@example.invalid",
    notes: "طلب تجريبي من اختبار Playwright"
  });
  expect(state.submissions[0]).not.toHaveProperty("status");
  expect(state.submissions[0]).not.toHaveProperty("reviewed_by");
});

test("service provider representative can claim a published profile with their signed-in account", async ({ page }) => {
  await seedAuthenticatedSession(page);
  const serviceEntity = {
    ...ENTITY,
    id: "d2222222-2222-4222-8222-222222222222",
    name_ar: "معرض اختبار لمواد البناء",
    entity_type: "other",
    service_category: "building_materials",
    description: "مقدم خدمات مواد البناء والتشطيب للاختبار."
  };
  const state = await mockCompanyClaimBackend(page, { entity: serviceEntity });

  await page.goto("/company.html?entity_id=" + serviceEntity.id);
  await expect(page.locator("#companyProfileRoot")).toContainText("ممثل مقدم الخدمة؟");
  await page.locator("#companyClaimOpen").click();
  await expect(page.locator("#companyClaimTitle")).toContainText("ممثل مقدم الخدمة");

  const form = await fillClaimForm(page, "مدير الفرع");
  await form.locator("button[type='submit']").click();

  await expect(page.locator("#companyClaimStatus")).toContainText("قيد المراجعة");
  await expect(form).toBeHidden();
  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0]).toMatchObject({
    directory_entity_id: serviceEntity.id,
    requester_user_id: USER_ID,
    representative_name: "ممثل الشركة التجريبي",
    representative_role: "مدير الفرع"
  });
  expect(state.submissions[0]).not.toHaveProperty("status");
  expect(state.submissions[0]).not.toHaveProperty("reviewed_by");
});

test("admin can review and approve a pending company claim from the claim queue", async ({ page }) => {
  await seedAuthenticatedSession(page);
  page.on("dialog", dialog => dialog.accept());
  const state = await mockCompanyClaimBackend(page, { claims: CLAIM });

  await page.goto("/admin.html");
  await page.locator("[data-view='review']").click();
  const card = page.locator("#pendingCompanyClaims [data-company-claim-id]");
  await expect(card).toHaveCount(1, { timeout: 15000 });
  await expect(card).toContainText(ENTITY.name_ar);
  await expect(card).toContainText("ممثل الشركة التجريبي");
  await card.locator("[data-company-claim-action='approve']").click();

  await expect(page.locator("#adminStatus")).toContainText("تم اعتماد الطلب وربط حساب ممثل الجهة بالملف.");
  expect(state.reviews).toHaveLength(1);
  expect(state.reviews[0]).toMatchObject({
    p_id: CLAIM.id,
    p_action: "approve",
    p_note: null
  });
});
