#!/usr/bin/env node
/**
 * Exercise LAYAN Storage RLS through the actual local Storage HTTP API.
 * Requires only environment variables returned by `supabase status -o env`.
 * Refuses to run against any non-loopback host.
 */

import { randomUUID, randomBytes } from 'node:crypto';

const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;

if (!apiUrl || !anonKey || !serviceRoleKey) {
  throw new Error('API_URL, ANON_KEY and SERVICE_ROLE_KEY are required from local Supabase CLI status.');
}

const parsedUrl = new URL(apiUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)) {
  throw new Error('Refusing to test Storage against a non-local Supabase host.');
}

const bucketPhotos = 'layan_real_estat';
const bucketDocuments = 'layan-property-documents';
const runId = randomUUID();
const password = `Aa!9${randomBytes(24).toString('hex')}`;
const emailA = `baseline-a-${runId}@example.test`;
const emailB = `baseline-b-${runId}@example.test`;
let userA;
let userB;
let tokenA;
let tokenB;
const createdObjects = [];

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

async function signIn(email) {
  const { response, body } = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: headers(anonKey, anonKey, { 'content-type': 'application/json' }),
    body: JSON.stringify({ email, password }),
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
  await request(`/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: headers(serviceRoleKey, serviceRoleKey),
  });
}

async function main() {
  userA = await createUser(emailA);
  userB = await createUser(emailB);
  tokenA = await signIn(emailA);
  tokenB = await signIn(emailB);

  const photoA = `offers/${userA.id}/offer.jpg`;
  const docA = `documents/${userA.id}/contract.pdf`;
  const docB = `documents/${userB.id}/contract.pdf`;
  const stolenPhoto = `offers/${userB.id}/intrusion.jpg`;

  const photoUpload = await upload(bucketPhotos, photoA, tokenA, 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  assert(photoUpload.ok, `Owner upload to own offer-photo folder failed (HTTP ${photoUpload.status}).`);
  createdObjects.push({ bucket: bucketPhotos, name: photoA, token: tokenA });

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
}
