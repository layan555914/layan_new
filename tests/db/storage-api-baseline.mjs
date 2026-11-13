#!/usr/bin/env node
/**
 * Exercise local Auth, directory admin RPC atomicity, and Storage RLS through the APIs.
 * Requires only environment variables returned by `supabase status -o env`.
 * Refuses to run against any non-loopback host.
 */

import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const mailpitUrl = String(process.env.MAILPIT_URL || 'http://127.0.0.1:54324').replace(/\/$/, '');

if (!apiUrl || !anonKey || !serviceRoleKey || !databaseUrl) {
  throw new Error('API_URL, ANON_KEY, SERVICE_ROLE_KEY and DATABASE_URL are required from local Supabase CLI status.');
}

const parsedUrl = new URL(apiUrl);
const parsedDatabaseUrl = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)
    || !['127.0.0.1', 'localhost', '::1'].includes(parsedDatabaseUrl.hostname)) {
  throw new Error('Refusing to run Auth, database or Storage tests against a non-local Supabase host.');
}

const bucketPhotos = 'layan_real_estat';
const bucketDocuments = 'layan-property-documents';
const runId = randomUUID();
const password = `Aa!9${randomBytes(24).toString('hex')}`;
const emailA = `baseline-a-${runId}@example.com`;
const emailB = `baseline-b-${runId}@example.com`;
const emailAdmin = `baseline-admin-${runId}@example.com`;
let userA;
let userB;
let userAdmin;
let tokenA;
let tokenB;
let tokenAdmin;
const createdObjects = [];
const createdMarketplaceListingIds = [];
const createdPropertyOfferIds = [];
const createdDirectoryEntityIds = [];
const createdDirectorySourceIds = [];
const createdDirectoryAuditIds = [];

function headers(apiKey, accessToken, extra = {}) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

async function request(path, options = {}) {
  const response = await fetch(new URL(path, apiUrl), options);
  const bodyText = await response.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createUser(email) {
  const { response, body } = await request('/auth/v1/admin/users', {
    method: 'POST',
    headers: headers(serviceRoleKey, serviceRoleKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert(response.ok && body?.id, `Could not create disposable local Auth user (HTTP ${response.status}).`);
  return body;
}

async function signUp(email) {
  const { response, body } = await request('/auth/v1/signup', {
    method: 'POST',
    headers: headers(anonKey, anonKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({ email, password }),
  });
  assert(response.ok && body?.user?.id && body?.access_token,
    `Local Auth sign-up did not create a session (HTTP ${response.status}).`);
  return { user: body.user, token: body.access_token };
}

async function signIn(email, suppliedPassword = password) {
  const { response, body } = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: headers(anonKey, anonKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({ email, password: suppliedPassword }),
  });
  assert(response.ok && body?.access_token, `Could not sign in disposable local Auth user (HTTP ${response.status}).`);
  return body.access_token;
}

function objectPath(bucket, name) {
  return `/storage/v1/object/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`;
}

async function upload(bucket, name, token, mimeType, bytes) {
  const { response } = await request(objectPath(bucket, name), {
    method: 'POST',
    headers: headers(anonKey, token, {
      'content-type': mimeType,
      'x-upsert': 'false',
    }),
    body: bytes,
  });
  return response;
}

async function download(bucket, name, token) {
  const { response } = await request(
    `/storage/v1/object/authenticated/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`,
    { headers: headers(anonKey, token) },
  );
  return response;
}

async function remove(bucket, names, token) {
  return request(`/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: headers(anonKey, token, { 'content-type': 'application/json' }),
    body: JSON.stringify({ prefixes: names }),
  });
}

async function deleteUser(id) {
  if (!id) return;
  const { response, body } = await request(`/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: headers(serviceRoleKey, serviceRoleKey),
  });
  assert([200, 204, 404].includes(response.status),
    `Could not delete disposable local Auth user ${id} (HTTP ${response.status}): ${JSON.stringify(body)}`);
}

function runLocalSql(sql) {
  return execFileSync('psql', [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function setLocalAdmin(userId, enabled) {
  assert(/^[0-9a-f-]{36}$/i.test(String(userId)), 'Refusing to modify the local admin allowlist with an invalid UUID.');
  const statement = enabled
    ? `INSERT INTO private.layan_admins(user_id) VALUES ('${userId}'::uuid) ON CONFLICT (user_id) DO NOTHING;`
    : `DELETE FROM private.layan_admins WHERE user_id = '${userId}'::uuid;`;
  runLocalSql(statement);
}

async function recoverPasswordThroughMailpit(email, oldPassword) {
  const recover = await request('/auth/v1/recover', {
    method: 'POST',
    headers: headers(anonKey, anonKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({ email }),
  });
  assert(recover.response.ok, `Local Auth recovery request failed (HTTP ${recover.response.status}): ${JSON.stringify(recover.body)}`);

  let message;
  for (let attempt = 0; attempt < 20 && !message; attempt += 1) {
    const listResponse = await fetch(mailpitUrl + '/api/v1/messages?start=0&limit=50');
    assert(listResponse.ok, `Mailpit is not reachable at ${mailpitUrl} (HTTP ${listResponse.status}).`);
    const list = await listResponse.json();
    const candidate = (list.messages || []).find(item => JSON.stringify(item.To || []).toLowerCase().includes(email.toLowerCase()));
    if (candidate?.ID) {
      const detailResponse = await fetch(mailpitUrl + '/api/v1/message/' + encodeURIComponent(candidate.ID));
      assert(detailResponse.ok, 'Mailpit did not return the recovery message details.');
      message = await detailResponse.json();
    } else {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  assert(message, 'Local Auth accepted recovery but no matching message arrived in Mailpit.');

  const html = String(message.HTML || '');
  const textBody = String(message.Text || '');
  const candidates = [
    ...[...html.matchAll(/href=["']([^"']+)["']/gi)].map(match => match[1].replace(/&amp;/g, '&')),
    ...[...textBody.matchAll(/https?:\/\/[^\s<>"]+/g)].map(match => match[0].replace(/&amp;/g, '&')),
  ];
  const recoveryUrl = candidates.find(value => {
    try {
      const url = new URL(value);
      return url.pathname.endsWith('/auth/v1/verify') && url.searchParams.get('type') === 'recovery';
    } catch { return false; }
  });
  assert(recoveryUrl, 'Recovery email did not contain a valid Supabase recovery verification link.');

  const verification = await fetch(recoveryUrl, { redirect: 'manual' });
  assert([301, 302, 303, 307, 308].includes(verification.status),
    `Recovery verification did not redirect as expected (HTTP ${verification.status}).`);
  const location = verification.headers.get('location');
  assert(location, 'Recovery verification response did not include a redirect location.');
  const redirectUrl = new URL(location, apiUrl);
  const hashParams = new URLSearchParams(redirectUrl.hash.replace(/^#/, ''));
  const queryParams = redirectUrl.searchParams;
  const recoveryAccessToken = hashParams.get('access_token') || queryParams.get('access_token');
  assert(recoveryAccessToken, 'Recovery link did not establish an access token.');

  const newPassword = oldPassword + '-Recovered!';
  const updateResponse = await fetch(new URL('/auth/v1/user', apiUrl), {
    method: 'PUT',
    headers: headers(anonKey, recoveryAccessToken, { 'content-type': 'application/json' }),
    body: JSON.stringify({ password: newPassword }),
  });
  assert(updateResponse.ok,
    `Password update via recovery session failed (HTTP ${updateResponse.status}): ${await updateResponse.text()}`);

  const signedIn = await signIn(email, newPassword);
  console.log('PASS: local Auth password recovery — Mailpit message delivered, recovery link verified, password updated, and new password sign-in succeeded.');
  return { token: signedIn, password: newPassword };
}


async function restRequest(path, options = {}) {
  const useServiceRole = options.serviceRole === true;
  const apiKey = useServiceRole ? serviceRoleKey : anonKey;
  const accessToken = useServiceRole ? serviceRoleKey : (options.token || anonKey);
  const extraHeaders = {};
  if (options.payload !== undefined) extraHeaders['content-type'] = 'application/json';
  if (options.prefer) extraHeaders.Prefer = options.prefer;
  const requestOptions = {
    method: options.method || 'GET',
    headers: headers(apiKey, accessToken, extraHeaders),
  };
  if (options.payload !== undefined) requestOptions.body = JSON.stringify(options.payload);
  return request(path, requestOptions);
}

async function testMarketplaceSecurity() {
  const listingPayload = {
    owner_id: userA.id,
    category: 'التنازلات العقارية',
    title: 'إعلان اختبار أمني',
    description: 'سجل اصطناعي لاختبار صلاحيات قاعدة البيانات المحلية فقط.',
    contact_phone: '01000000000',
  };

  const created = await restRequest('/rest/v1/marketplace_listings', {
    method: 'POST',
    token: tokenA,
    payload: listingPayload,
    prefer: 'return=representation',
  });
  assert(
    created.response.ok && Array.isArray(created.body) && created.body.length === 1 && created.body[0]?.id,
    `Owner could not submit a valid pending marketplace listing (HTTP ${created.response.status}).`,
  );

  const listingId = created.body[0].id;
  createdMarketplaceListingIds.push(listingId);

  const ownerRead = await restRequest(
    `/rest/v1/marketplace_listings?select=id,status,is_featured,admin_notes,reviewed_at,reviewed_by&id=eq.${encodeURIComponent(listingId)}`,
    { token: tokenA },
  );
  assert(ownerRead.response.ok && ownerRead.body?.length === 1, 'Owner could not read their own pending marketplace listing.');
  assert(
    ownerRead.body[0].status === 'pending' && ownerRead.body[0].is_featured === false,
    'A normal owner listing must remain pending and not featured.',
  );

  const otherOwnerRead = await restRequest(
    `/rest/v1/marketplace_listings?select=id&id=eq.${encodeURIComponent(listingId)}`,
    { token: tokenB },
  );
  assert(otherOwnerRead.response.ok && Array.isArray(otherOwnerRead.body) && otherOwnerRead.body.length === 0,
    'A different authenticated user read a pending marketplace listing.');

  const anonymousRead = await restRequest(
    `/rest/v1/marketplace_listings?select=id&id=eq.${encodeURIComponent(listingId)}`,
    { token: anonKey },
  );
  assert(anonymousRead.response.ok && Array.isArray(anonymousRead.body) && anonymousRead.body.length === 0,
    'An anonymous visitor read a pending marketplace listing.');

  const forgedFeaturedInsert = await restRequest('/rest/v1/marketplace_listings', {
    method: 'POST',
    token: tokenA,
    payload: { ...listingPayload, title: 'إعلان مميز مزور', is_featured: true },
    prefer: 'return=representation',
  });
  assert(!forgedFeaturedInsert.response.ok,
    'Owner inserted a marketplace listing with the admin-controlled is_featured flag.');

  const forgedApproval = await restRequest(
    `/rest/v1/marketplace_listings?id=eq.${encodeURIComponent(listingId)}`,
    { method: 'PATCH', token: tokenA, payload: { status: 'approved' }, prefer: 'return=representation' },
  );
  assert(!forgedApproval.response.ok, 'Owner approved their own pending marketplace listing.');

  const forgedPromotion = await restRequest(
    `/rest/v1/marketplace_listings?id=eq.${encodeURIComponent(listingId)}`,
    { method: 'PATCH', token: tokenA, payload: { is_featured: true }, prefer: 'return=representation' },
  );
  assert(!forgedPromotion.response.ok, 'Owner marked their own marketplace listing as featured.');

  const finalOwnerRead = await restRequest(
    `/rest/v1/marketplace_listings?select=id,status,is_featured&id=eq.${encodeURIComponent(listingId)}`,
    { token: tokenA },
  );
  assert(
    finalOwnerRead.response.ok && finalOwnerRead.body?.length === 1
      && finalOwnerRead.body[0].status === 'pending'
      && finalOwnerRead.body[0].is_featured === false,
    'A denied owner privilege escalation changed the marketplace listing.',
  );

  // These calls must fail for the non-admin test users; the test never creates an admin.
  const rpcCases = [
    ['layan_activate_supplier_ad', { p_ad_id: randomUUID(), p_days: 30, p_price: 0 }],
    ['layan_reject_supplier_ad', { p_ad_id: randomUUID(), p_reason: 'سبب اختبار غير إداري' }],
    ['layan_approve_free_trial_ad', { p_ad_id: randomUUID() }],
  ];
  for (const [rpcName, payload] of rpcCases) {
    const result = await restRequest(`/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      token: tokenA,
      payload,
    });
    assert(!result.response.ok, `Non-admin user successfully invoked ${rpcName}.`);
  }

  // Anonymous callers must not have EXECUTE on admin RPC endpoints.
  for (const [rpcName, payload] of rpcCases) {
    const result = await restRequest(`/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      token: anonKey,
      payload,
    });
    assert(!result.response.ok, `Anonymous caller successfully invoked ${rpcName}.`);
  }

  console.log('PASS: marketplace owner isolation, anonymous pending-read denial, admin-field escalation denial, self-approval denial, and non-admin/anonymous supplier RPC denial.');
}


async function testPropertyOfferLifecycle(photoUrl) {
  const basePayload = {
    owner_id: userA.id, title: 'شقة اختبار دورة العقار — اصطناعي فقط',
    governorate: 'أسيوط', city: 'أسيوط (اختبار محلي)', area: 'منطقة اختبار محلية',
    property_type: 'شقة', listing_purpose: 'تنازل', bedrooms: 3, bathrooms: 1, area_m2: 115,
    total_price: 600000, down_payment: 100000, paid_amount: 100000,
    remaining_amount: 500000, remaining_installments: 500000, monthly_installment: 5000,
    assignment_fee: 0, assignment_fee_percentage: 0, transfer_fee: 0,
    discount_amount: 0, discount_percent: 0,
    description: 'بيانات اصطناعية لا تمثل عقاراً حقيقياً؛ لا تتصل بصاحب الإعلان.',
    image_urls: photoUrl ? [photoUrl] : [], photos: [], document_urls: [],
    developer_name: 'مطور افتراضي للاختبار', project_name: 'مشروع افتراضي للاختبار',
    contact_name: 'مالك اختبار', contact_phone: '0000000000',
    status: 'pending', verification_status: 'pending', developer_approval_status: 'unknown',
    featured_requested: false, is_featured: false, promotion_status: 'none',
  };

  async function submit(title) {
    const result = await restRequest('/rest/v1/property_offers', {
      method: 'POST', token: tokenA,
      payload: { ...basePayload, title }, prefer: 'return=representation',
    });
    assert(result.response.ok && Array.isArray(result.body) && result.body.length === 1 && result.body[0]?.id,
      `Owner could not submit a pending property offer (HTTP ${result.response.status}): ${JSON.stringify(result.body)}`);
    const row = result.body[0];
    createdPropertyOfferIds.push(row.id);
    assert(row.status === 'pending' && row.verification_status === 'pending' && row.is_featured === false,
      'A newly submitted property offer did not start in the safe pending state.');
    return row;
  }

  const approveOffer = await submit('شقة اختبار — سيتم اعتمادها');
  const rejectOffer = await submit('شقة اختبار — سيتم رفضها');

  const ownerRead = await restRequest(
    `/rest/v1/property_offers?select=id,status,verification_status,image_urls&id=eq.${approveOffer.id}`, { token: tokenA });
  assert(ownerRead.response.ok && ownerRead.body?.length === 1
    && ownerRead.body[0].status === 'pending' && ownerRead.body[0].image_urls?.[0] === photoUrl,
    'Owner could not read their pending offer and stored image URL.');

  const otherUserRead = await restRequest(
    `/rest/v1/property_offers?select=id&id=eq.${approveOffer.id}`, { token: tokenB });
  assert(otherUserRead.response.ok && Array.isArray(otherUserRead.body) && otherUserRead.body.length === 0,
    'A different account read a pending property offer.');

  const anonymousReadBefore = await restRequest(
    `/rest/v1/property_offers?select=id&id=eq.${approveOffer.id}`, { token: anonKey });
  assert(anonymousReadBefore.response.ok && Array.isArray(anonymousReadBefore.body) && anonymousReadBefore.body.length === 0,
    'Anonymous visitor read a pending property offer.');

  const selfApprovalAttempt = await restRequest(
    `/rest/v1/property_offers?id=eq.${approveOffer.id}&status=eq.pending`,
    { method: 'PATCH', token: tokenA, payload: { status: 'available', verification_status: 'verified' }, prefer: 'return=representation' });
  const stillPending = await restRequest(
    `/rest/v1/property_offers?select=id,status,verification_status,is_featured&id=eq.${approveOffer.id}`,
    { serviceRole: true });
  assert(stillPending.response.ok && stillPending.body?.length === 1
    && stillPending.body[0].status === 'pending'
    && stillPending.body[0].verification_status === 'pending'
    && stillPending.body[0].is_featured === false,
    `Owner self-approval changed the offer (PATCH HTTP ${selfApprovalAttempt.response.status}).`);

  const adminCheck = await restRequest('/rest/v1/rpc/layan_is_admin', { method: 'POST', token: tokenAdmin, payload: {} });
  assert(adminCheck.response.ok && adminCheck.body === true, 'Disposable local admin account was not recognized.');
  const ownerAdminCheck = await restRequest('/rest/v1/rpc/layan_is_admin', { method: 'POST', token: tokenA, payload: {} });
  assert(ownerAdminCheck.response.ok && ownerAdminCheck.body === false, 'An ordinary owner incorrectly gained admin privileges.');

  const adminPendingRead = await restRequest(
    `/rest/v1/property_offers?select=id,status&id=eq.${approveOffer.id}&status=eq.pending`, { token: tokenAdmin });
  assert(adminPendingRead.response.ok && adminPendingRead.body?.length === 1,
    'Admin could not see the pending property offer.');

  const approve = await restRequest('/rest/v1/rpc/layan_admin_review_property_offer', {
    method: 'POST', token: tokenAdmin,
    payload: { p_id: Number(approveOffer.id), p_action: 'approve', p_notes: null },
  });
  assert(approve.response.ok, `Admin could not approve property offer (HTTP ${approve.response.status}): ${JSON.stringify(approve.body)}`);

  const publicApprovedRead = await restRequest(
    `/rest/v1/property_offers?select=id,title,status,verification_status,image_urls&id=eq.${approveOffer.id}&status=eq.available`,
    { token: anonKey });
  assert(publicApprovedRead.response.ok && publicApprovedRead.body?.length === 1
    && publicApprovedRead.body[0].verification_status === 'verified'
    && publicApprovedRead.body[0].image_urls?.[0] === photoUrl,
    'Approved property offer was not publicly visible with its image URL.');

  const publicImage = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
  assert(publicImage.ok, `Approved offer image was not publicly readable (HTTP ${publicImage.status}).`);

  const reject = await restRequest('/rest/v1/rpc/layan_admin_review_property_offer', {
    method: 'POST', token: tokenAdmin,
    payload: { p_id: Number(rejectOffer.id), p_action: 'reject', p_notes: 'سجل اصطناعي للاختبار فقط' },
  });
  assert(reject.response.ok, `Admin could not reject property offer (HTTP ${reject.response.status}): ${JSON.stringify(reject.body)}`);

  const rejectedOwnerRead = await restRequest(
    `/rest/v1/property_offers?select=id,status,verification_status,verification_notes&id=eq.${rejectOffer.id}`, { token: tokenA });
  assert(rejectedOwnerRead.response.ok && rejectedOwnerRead.body?.length === 1
    && rejectedOwnerRead.body[0].status === 'pending'
    && rejectedOwnerRead.body[0].verification_status === 'rejected'
    && rejectedOwnerRead.body[0].verification_notes === 'سجل اصطناعي للاختبار فقط',
    'Rejected offer must retain its allowed pending status and store the rejected verification state and reason.');

  const anonymousRejectedRead = await restRequest(
    `/rest/v1/property_offers?select=id&id=eq.${rejectOffer.id}`, { token: anonKey });
  assert(anonymousRejectedRead.response.ok && Array.isArray(anonymousRejectedRead.body) && anonymousRejectedRead.body.length === 0,
    'Anonymous visitor read a rejected property offer.');

  console.log('PASS: property lifecycle — local Auth owner submission, pending-state protection, owner isolation, admin approval/rejection, public visibility, and image access.');
}


async function testDirectoryAdminAtomicRpc() {
  assert(userAdmin?.id && tokenAdmin, 'A disposable local admin identity is required for the directory RPC test.');
  const entityId = randomUUID();
  const slug = `ci-directory-admin-${randomUUID()}`;
  createdDirectoryEntityIds.push(entityId);

  runLocalSql(`
    INSERT INTO public.directory_entities
      (id, slug, name_ar, entity_type, verification_status, public_visible)
    VALUES
      ('${entityId}'::uuid, '${slug}', 'جهة اختبار الإدارة الذرية', 'developer', 'draft', false);
  `);

  const rpcPath = '/rest/v1/rpc/directory_admin_mutate_with_audit';
  const deniedMember = await restRequest(rpcPath, {
    method: 'POST',
    token: tokenA,
    payload: {
      p_table_name: 'directory_entities',
      p_operation: 'update',
      p_record_id: entityId,
      p_data: { description: 'يجب ألا ينجح تعديل المستخدم العادي' },
      p_reason: 'CI non-admin denial',
    },
  });
  assert(!deniedMember.response.ok, 'An authenticated non-admin user executed the directory mutation RPC.');

  const deniedAnonymous = await restRequest(rpcPath, {
    method: 'POST',
    token: anonKey,
    payload: {
      p_table_name: 'directory_entities',
      p_operation: 'update',
      p_record_id: entityId,
      p_data: { description: 'يجب ألا ينجح تعديل الزائر' },
      p_reason: 'CI anonymous denial',
    },
  });
  assert(!deniedAnonymous.response.ok, 'An anonymous visitor executed the directory mutation RPC.');

  const update = await restRequest(rpcPath, {
    method: 'POST',
    token: tokenAdmin,
    payload: {
      p_table_name: 'directory_entities',
      p_operation: 'update',
      p_record_id: entityId,
      p_data: { description: 'تحديث اصطناعي عبر RPC ذرية لاختبار CI المحلي.' },
      p_reason: 'CI directory entity update',
    },
  });
  assert(update.response.ok && update.body?.record?.id === entityId && update.body?.audit_id,
    `Admin update did not return its saved record and audit id (HTTP ${update.response.status}).`);
  createdDirectoryAuditIds.push(update.body.audit_id);

  const savedEntity = await restRequest(
    `/rest/v1/directory_entities?select=id,description&id=eq.${entityId}`,
    { serviceRole: true },
  );
  assert(savedEntity.response.ok && savedEntity.body?.length === 1
    && savedEntity.body[0].description === 'تحديث اصطناعي عبر RPC ذرية لاختبار CI المحلي.',
    'The directory admin RPC did not persist the expected entity description.');

  const forbiddenColumn = await restRequest(rpcPath, {
    method: 'POST',
    token: tokenAdmin,
    payload: {
      p_table_name: 'directory_entities',
      p_operation: 'update',
      p_record_id: entityId,
      p_data: { id: randomUUID() },
      p_reason: 'CI forbidden primary key mutation',
    },
  });
  assert(!forbiddenColumn.response.ok, 'The directory admin RPC accepted a forbidden primary-key field.');

  const sourceInsert = await restRequest(rpcPath, {
    method: 'POST',
    token: tokenAdmin,
    payload: {
      p_table_name: 'directory_sources',
      p_operation: 'insert',
      p_record_id: null,
      p_data: {
        title: 'مصدر اصطناعي لاختبار RPC المحلية',
        publisher: 'ASYUT AQAR CI',
        source_type: 'automated_test',
        source_url: 'https://example.invalid/asyut-aqar-ci-directory-source',
        confidence_level: 'unverified',
        is_public: false,
        notes: 'Synthetic CI-only source; deleted by the local test cleanup.',
      },
      p_reason: 'CI directory source insert',
    },
  });
  const sourceId = sourceInsert.body?.record?.id;
  assert(sourceInsert.response.ok && sourceId && sourceInsert.body?.audit_id,
    `Admin source insert did not return its record and audit id (HTTP ${sourceInsert.response.status}).`);
  createdDirectorySourceIds.push(sourceId);
  createdDirectoryAuditIds.push(sourceInsert.body.audit_id);

  const linkInsert = await restRequest(rpcPath, {
    method: 'POST',
    token: tokenAdmin,
    payload: {
      p_table_name: 'directory_entity_sources',
      p_operation: 'insert',
      p_record_id: entityId,
      p_data: { entity_id: entityId, source_id: sourceId, claim_key: 'general' },
      p_reason: 'CI directory source link',
    },
  });
  assert(linkInsert.response.ok && linkInsert.body?.record?.entity_id === entityId
    && linkInsert.body?.audit_id,
    `Admin source link insert did not return its record and audit id (HTTP ${linkInsert.response.status}).`);
  createdDirectoryAuditIds.push(linkInsert.body.audit_id);

  const linked = await restRequest(
    `/rest/v1/directory_entity_sources?select=entity_id,source_id&entity_id=eq.${entityId}&source_id=eq.${sourceId}`,
    { serviceRole: true },
  );
  assert(linked.response.ok && linked.body?.length === 1,
    'The source link was not persisted by the directory admin RPC.');

  let guardInstalled = false;
  try {
    runLocalSql(`
      CREATE OR REPLACE FUNCTION public.ci_force_directory_audit_failure()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path TO ''
      AS $function$
      BEGIN
        IF NEW.reason = 'CI forced audit failure' THEN
          RAISE EXCEPTION 'forced CI directory audit failure';
        END IF;
        RETURN NEW;
      END;
      $function$;
      DROP TRIGGER IF EXISTS ci_force_directory_audit_failure ON public.directory_change_log;
      CREATE TRIGGER ci_force_directory_audit_failure
      BEFORE INSERT ON public.directory_change_log
      FOR EACH ROW EXECUTE FUNCTION public.ci_force_directory_audit_failure();
    `);
    guardInstalled = true;

    const failedUpdate = await restRequest(rpcPath, {
      method: 'POST',
      token: tokenAdmin,
      payload: {
        p_table_name: 'directory_entities',
        p_operation: 'update',
        p_record_id: entityId,
        p_data: { description: 'لا يجب حفظ هذا التعديل عند فشل التدقيق' },
        p_reason: 'CI forced audit failure',
      },
    });
    assert(!failedUpdate.response.ok, 'The forced directory audit insert failure did not fail the RPC.');

    const afterFailure = await restRequest(
      `/rest/v1/directory_entities?select=id,description&id=eq.${entityId}`,
      { serviceRole: true },
    );
    assert(afterFailure.response.ok && afterFailure.body?.length === 1
      && afterFailure.body[0].description === 'تحديث اصطناعي عبر RPC ذرية لاختبار CI المحلي.',
      'Directory entity data changed even though its audit insert failed.');

    const failedAuditCount = runLocalSql(`
      SELECT count(*)
      FROM public.directory_change_log
      WHERE changed_by = '${userAdmin.id}'::uuid
        AND reason = 'CI forced audit failure';
    `);
    assert(Number(failedAuditCount) === 0,
      'A failed directory mutation unexpectedly left an audit row.');
  } finally {
    if (guardInstalled) {
      runLocalSql(`
        DROP TRIGGER IF EXISTS ci_force_directory_audit_failure ON public.directory_change_log;
        DROP FUNCTION IF EXISTS public.ci_force_directory_audit_failure();
      `);
    }
  }

  const auditCount = runLocalSql(`
    SELECT count(*)
    FROM public.directory_change_log
    WHERE id IN (${createdDirectoryAuditIds.map(id => `'${id}'::uuid`).join(',')});
  `);
  assert(Number(auditCount) === 3,
    `Expected exactly three audit rows for the three successful RPC calls; found ${auditCount}.`);

  console.log('PASS: directory admin RPC — non-admin/anon denial, allowlisted update, source insert/link, forbidden-column denial, atomic audit rollback, and three successful audit rows.');
}

async function main() {
  const ownerSignup = await signUp(emailA);
  userA = ownerSignup.user;
  tokenA = ownerSignup.token;
  userB = await createUser(emailB);
  userAdmin = await createUser(emailAdmin);
  tokenB = await signIn(emailB);
  tokenAdmin = await signIn(emailAdmin);
  setLocalAdmin(userAdmin.id, true);

  const recovered = await recoverPasswordThroughMailpit(emailA, password);
  tokenA = recovered.token;

  await testMarketplaceSecurity();
  await testDirectoryAdminAtomicRpc();

  const photoA = `offers/${userA.id}/offer.jpg`;
  const docA = `documents/${userA.id}/contract.pdf`;
  const docB = `documents/${userB.id}/contract.pdf`;
  const stolenPhoto = `offers/${userB.id}/intrusion.jpg`;

  const photoUpload = await upload(bucketPhotos, photoA, tokenA, 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  assert(photoUpload.ok, `Owner upload to own offer-photo folder failed (HTTP ${photoUpload.status}).`);
  createdObjects.push({ bucket: bucketPhotos, name: photoA, token: tokenA });

  const photoUrl = `${apiUrl}/storage/v1/object/public/${bucketPhotos}/${photoA.split('/').map(encodeURIComponent).join('/')}`;
  await testPropertyOfferLifecycle(photoUrl);

  const docUploadA = await upload(bucketDocuments, docA, tokenA, 'application/pdf', Buffer.from('%PDF-1.4 test owner A'));
  assert(docUploadA.ok, `Owner upload to own document folder failed (HTTP ${docUploadA.status}).`);
  createdObjects.push({ bucket: bucketDocuments, name: docA, token: tokenA });

  const docUploadB = await upload(bucketDocuments, docB, tokenB, 'application/pdf', Buffer.from('%PDF-1.4 test owner B'));
  assert(docUploadB.ok, `Second owner upload to own document folder failed (HTTP ${docUploadB.status}).`);
  createdObjects.push({ bucket: bucketDocuments, name: docB, token: tokenB });

  const crossOwnerUpload = await upload(bucketPhotos, stolenPhoto, tokenA, 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  assert(!crossOwnerUpload.ok, 'A user uploaded a photo into another user folder.');
  
  const ownRead = await download(bucketDocuments, docA, tokenA);
  assert(ownRead.ok, `Owner could not read their own private document (HTTP ${ownRead.status}).`);

  const crossOwnerRead = await download(bucketDocuments, docB, tokenA);
  assert(!crossOwnerRead.ok, 'A user read another user private document.');

  const anonymousRead = await download(bucketDocuments, docB, anonKey);
  assert(!anonymousRead.ok, 'Anonymous visitor read a private property document.');

  // Storage removal must use the HTTP API; direct SQL DELETE is intentionally blocked.
  await remove(bucketDocuments, [docB], tokenA);
  const stillOwnedByB = await download(bucketDocuments, docB, tokenB);
  assert(stillOwnedByB.ok, 'Owner A deleted or damaged owner B private document.');

  const ownerDelete = await remove(bucketDocuments, [docB], tokenB);
  assert(ownerDelete.response.ok, `Owner B could not delete their own document through Storage API (HTTP ${ownerDelete.response.status}).`);
  const removedByOwner = await download(bucketDocuments, docB, tokenB);
  assert(!removedByOwner.ok, 'Owner B document still exists after successful Storage API delete.');

  const ownDelete = await remove(bucketDocuments, [docA], tokenA);
  assert(ownDelete.response.ok, `Owner A could not delete their own document through Storage API (HTTP ${ownDelete.response.status}).`);

  console.log('PASS: local Storage API authenticated uploads, owner read, cross-owner upload/read/delete denial, anonymous private-file denial, and owner-only deletion.');
}

try {
  await main();
} finally {
  // Best-effort cleanup inside the disposable local project; service_role is local-only.
  for (const id of createdPropertyOfferIds.reverse()) {
    try {
      await restRequest(`/rest/v1/property_offers?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE', serviceRole: true, prefer: 'return=minimal',
      });
    } catch {
      // The local stack is disposable and is stopped by the caller's EXIT trap.
    }
  }

  if (userAdmin?.id) {
    try { setLocalAdmin(userAdmin.id, false); } catch {}
  }

  for (const id of createdMarketplaceListingIds.reverse()) {
    try {
      await restRequest(`/rest/v1/marketplace_listings?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        serviceRole: true,
        prefer: 'return=minimal',
      });
    } catch {
      // The local Supabase stack is disposable and is stopped by the caller's EXIT trap.
    }
  }

  // Remove the injected failure trigger even if the RPC test aborted before its inner cleanup.
  try {
    runLocalSql(`
      DROP TRIGGER IF EXISTS ci_force_directory_audit_failure ON public.directory_change_log;
      DROP FUNCTION IF EXISTS public.ci_force_directory_audit_failure();
    `);
  } catch {
    // The trigger may not have been installed; the temporary local stack is disposable.
  }

  // Remove local directory RPC fixtures and audit rows using the disposable local database only.
  try {
    const entityIds = createdDirectoryEntityIds.length
      ? createdDirectoryEntityIds.map(id => `'${id}'::uuid`).join(',') : 'NULL::uuid';
    const sourceIds = createdDirectorySourceIds.length
      ? createdDirectorySourceIds.map(id => `'${id}'::uuid`).join(',') : 'NULL::uuid';
    const auditIds = createdDirectoryAuditIds.length
      ? createdDirectoryAuditIds.map(id => `'${id}'::uuid`).join(',') : 'NULL::uuid';
    runLocalSql(`
      DELETE FROM public.directory_entity_sources
      WHERE entity_id IN (${entityIds}) OR source_id IN (${sourceIds});
      DELETE FROM public.directory_change_log WHERE id IN (${auditIds});
      DELETE FROM public.directory_sources WHERE id IN (${sourceIds});
      DELETE FROM public.directory_entities WHERE id IN (${entityIds});
    `);
  } catch {
    // A failure is detected by the zero-residual assertion below; the stack is disposable.
  }

  // Best-effort cleanup through the Storage API before deleting temporary Auth users.
  for (const object of createdObjects.reverse()) {
    try {
      await remove(object.bucket, [object.name], object.token);
    } catch {
      // The local stack is disposable and is stopped by the caller's EXIT trap.
    }
  }
  await deleteUser(userA?.id);
  await deleteUser(userB?.id);
  await deleteUser(userAdmin?.id);

  // Verify every created test artifact was removed before the disposable stack exits.
  const userIds = [userA?.id, userB?.id, userAdmin?.id].filter(Boolean);
  for (const id of userIds) assert(/^[0-9a-f-]{36}$/i.test(String(id)), 'Invalid cleanup Auth user UUID.');
  const uuidList = userIds.length ? userIds.map(id => `'${id}'::uuid`).join(',') : 'NULL::uuid';
  const propertyIdList = createdPropertyOfferIds.length
    ? createdPropertyOfferIds.map(id => String(Number(id))).join(',') : 'NULL::bigint';
  const listingIdList = createdMarketplaceListingIds.length
    ? createdMarketplaceListingIds.map(id => `'${String(id)}'::uuid`).join(',') : 'NULL::uuid';
  const quoteSql = value => "'" + String(value).replace(/'/g, "''") + "'";
  const storagePredicate = createdObjects.length
    ? createdObjects.map(object => `(bucket_id = ${quoteSql(object.bucket)} AND name = ${quoteSql(object.name)})`).join(' OR ')
    : 'false';
  const directoryEntityIds = createdDirectoryEntityIds.length
    ? createdDirectoryEntityIds.map(id => `'${id}'::uuid`).join(',') : 'NULL::uuid';
  const directorySourceIds = createdDirectorySourceIds.length
    ? createdDirectorySourceIds.map(id => `'${id}'::uuid`).join(',') : 'NULL::uuid';
  const directoryAuditIds = createdDirectoryAuditIds.length
    ? createdDirectoryAuditIds.map(id => `'${id}'::uuid`).join(',') : 'NULL::uuid';
  const remaining = Number(runLocalSql(`
    SELECT
      (SELECT count(*) FROM public.directory_entities WHERE id IN (${directoryEntityIds})) +
      (SELECT count(*) FROM public.directory_sources WHERE id IN (${directorySourceIds})) +
      (SELECT count(*) FROM public.directory_entity_sources WHERE entity_id IN (${directoryEntityIds}) OR source_id IN (${directorySourceIds})) +
      (SELECT count(*) FROM public.directory_change_log WHERE id IN (${directoryAuditIds})) +
      (SELECT count(*) FROM auth.users WHERE id IN (${uuidList})) +
      (SELECT count(*) FROM auth.identities WHERE user_id IN (${uuidList})) +
      (SELECT count(*) FROM private.layan_admins WHERE user_id IN (${uuidList})) +
      (SELECT count(*) FROM public.property_offers WHERE id IN (${propertyIdList})) +
      (SELECT count(*) FROM public.marketplace_listings WHERE id IN (${listingIdList})) +
      (SELECT count(*) FROM storage.objects WHERE ${storagePredicate});
  `));
  assert(remaining === 0, `Temporary directory fixtures/audits, Auth users/identities, admin rows, property offers, marketplace listings or Storage objects remained after cleanup (count=${remaining}).`);
  console.log('PASS: local test cleanup verified zero remaining directory fixtures/audits, Auth users/identities, admin rows, property offers, marketplace listings and Storage objects.');
}
