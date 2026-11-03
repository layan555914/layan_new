#!/usr/bin/env node
/**
 * ASYUT AQAR synthetic-only migration planner.
 * No Supabase SDK, SQL driver, HTTP calls, file export, or network access.
 * This command only validates embedded synthetic fixture rows and prints a dry-run plan.
 * Any database execution mode is deliberately unavailable.
 */
import assert from "node:assert/strict";

const TABLES = {
  "auth.users":["id"], "auth.identities":["id"], "private.layan_admins":["user_id"],
  "private.project_decisions":["id"], "public.buyer_offer_alerts":["id"],
  "public.buyer_preferences":["id"], "public.buyer_push_subscriptions":["id"],
  "public.buyer_push_vapid_config":["id"], "public.company_profiles":["id"],
  "public.company_property_ads":["id"], "public.directory_areas":["id"],
  "public.directory_change_log":["id"], "public.directory_entities":["id"],
  "public.directory_entity_areas":["entity_id","area_id"],
  "public.directory_entity_private":["entity_id"],
  "public.directory_entity_sources":["entity_id","source_id","claim_key"],
  "public.directory_opportunities":["id"],
  "public.directory_opportunity_sources":["opportunity_id","source_id","claim_key"],
  "public.directory_project_entities":["project_id","entity_id"],
  "public.directory_project_private":["project_id"],
  "public.directory_project_sources":["project_id","source_id","claim_key"],
  "public.directory_projects":["id"], "public.directory_sources":["id"],
  "public.marketplace_categories":["name"], "public.marketplace_listings":["id"],
  "public.partner_ad_slots":["slot_key"], "public.promotion_payments":["id"],
  "public.property_offers":["id"], "public.supplier_ads":["id"],
  "public.user_favorite_offers":["user_id","offer_id"]
};

const BLOCKED_TABLES = new Set([
  "public.buyer_push_subscriptions",
  "public.buyer_push_vapid_config"
]);

// [child table, child column, parent table, parent column]
const FOREIGN_KEYS = [
  ["auth.identities","user_id","auth.users","id"],
  ["private.layan_admins","user_id","auth.users","id"],
  ["public.buyer_offer_alerts","offer_id","public.property_offers","id"],
  ["public.buyer_offer_alerts","user_id","auth.users","id"],
  ["public.buyer_preferences","owner_id","auth.users","id"],
  ["public.buyer_push_subscriptions","user_id","auth.users","id"],
  ["public.company_profiles","owner_id","auth.users","id"],
  ["public.company_profiles","reviewed_by","auth.users","id"],
  ["public.company_property_ads","owner_id","auth.users","id"],
  ["public.directory_areas","parent_id","public.directory_areas","id"],
  ["public.directory_entities","primary_area_id","public.directory_areas","id"],
  ["public.directory_entity_areas","area_id","public.directory_areas","id"],
  ["public.directory_entity_areas","entity_id","public.directory_entities","id"],
  ["public.directory_entity_private","entity_id","public.directory_entities","id"],
  ["public.directory_entity_sources","entity_id","public.directory_entities","id"],
  ["public.directory_entity_sources","source_id","public.directory_sources","id"],
  ["public.directory_opportunity_sources","opportunity_id","public.directory_opportunities","id"],
  ["public.directory_opportunity_sources","source_id","public.directory_sources","id"],
  ["public.directory_project_entities","entity_id","public.directory_entities","id"],
  ["public.directory_project_entities","project_id","public.directory_projects","id"],
  ["public.directory_project_private","project_id","public.directory_projects","id"],
  ["public.directory_project_sources","project_id","public.directory_projects","id"],
  ["public.directory_project_sources","source_id","public.directory_sources","id"],
  ["public.directory_projects","area_id","public.directory_areas","id"],
  ["public.marketplace_listings","owner_id","auth.users","id"],
  ["public.marketplace_listings","reviewed_by","auth.users","id"],
  ["public.promotion_payments","offer_id","public.property_offers","id"],
  ["public.property_offers","company_ad_id","public.company_property_ads","id"],
  ["public.property_offers","owner_id","auth.users","id"],
  ["public.supplier_ads","owner_id","auth.users","id"],
  ["public.user_favorite_offers","offer_id","public.property_offers","id"],
  ["public.user_favorite_offers","user_id","auth.users","id"]
];

const FORBIDDEN_KEYS = /(^|_)(password|encrypted_password|access_token|refresh_token|id_token|one_time_token|private_key|secret|service_role|apikey|p256dh|vapid)(_|$)/i;
const SYNTHETIC_UUID_PREFIX = "00000000-0000-4000-8000-";
const uuid = (n) => SYNTHETIC_UUID_PREFIX + String(n).padStart(12,"0");
const fixtureRow = (values) => ({ synthetic:true, values });

function syntheticFixture() {
  const user = uuid(1), identity = uuid(2), root = uuid(10), child = uuid(11);
  const source = uuid(20), entity = uuid(30), project = uuid(40), opportunity = uuid(50), ad = uuid(60);
  return {
    fixture_id:"ASYUT_AQAR_SYNTHETIC_FIXTURE_V1",
    classification:"synthetic-only",
    records:{
      "auth.users":[fixtureRow({id:user,email:"synthetic-owner@example.test",role:"authenticated"})],
      "auth.identities":[fixtureRow({id:identity,user_id:user,provider:"email",identity_data:{sub:user}})],
      "private.layan_admins":[fixtureRow({user_id:user})],
      "public.directory_areas":[
        fixtureRow({id:child,slug:"synthetic-child-area",name_ar:"منطقة فرعية تجريبية",area_type:"district",parent_id:root}),
        fixtureRow({id:root,slug:"synthetic-root-area",name_ar:"منطقة رئيسية تجريبية",area_type:"city",parent_id:null})
      ],
      "public.directory_sources":[fixtureRow({id:source,title:"مصدر اصطناعي",source_type:"official_site",source_url:"https://example.test/synthetic",is_public:true})],
      "public.directory_entities":[fixtureRow({id:entity,slug:"synthetic-entity",name_ar:"شركة تجريبية",entity_type:"developer",primary_area_id:child,verification_status:"draft",public_visible:false})],
      "public.directory_entity_private":[fixtureRow({entity_id:entity,internal_address:"عنوان تجريبي"})],
      "public.directory_entity_sources":[fixtureRow({entity_id:entity,source_id:source,claim_key:"general"})],
      "public.directory_projects":[fixtureRow({id:project,slug:"synthetic-project",name_ar:"مشروع تجريبي",project_type:"residential",area_id:child,verification_status:"draft",public_visible:false})],
      "public.directory_project_private":[fixtureRow({project_id:project,confidence_level:"synthetic"})],
      "public.directory_project_sources":[fixtureRow({project_id:project,source_id:source,claim_key:"general"})],
      "public.directory_project_entities":[fixtureRow({project_id:project,entity_id:entity,relation_type:"developer"})],
      "public.directory_opportunities":[fixtureRow({id:opportunity,slug:"synthetic-opportunity",name_ar:"فرصة تجريبية",verification_status:"needs_review",public_visible:false})],
      "public.directory_opportunity_sources":[fixtureRow({opportunity_id:opportunity,source_id:source,claim_key:"general"})],
      "public.company_property_ads":[fixtureRow({id:ad,owner_id:user,business_name:"شركة إعلان تجريبية",status:"pending"})],
      "public.property_offers":[fixtureRow({id:700001,owner_id:user,company_ad_id:ad,title:"وحدة تجريبية لا تمثل عرضًا حقيقيًا",status:"pending"})],
      "public.buyer_offer_alerts":[fixtureRow({id:uuid(70),user_id:user,offer_id:700001,title_snapshot:"تنبيه تجريبي"})],
      "public.user_favorite_offers":[fixtureRow({user_id:user,offer_id:700001})],
      "public.promotion_payments":[fixtureRow({id:700101,offer_id:700001,amount_egp:0,status:"pending"})],
      "public.marketplace_listings":[fixtureRow({id:uuid(80),owner_id:user,category:"synthetic",title:"إعلان تجريبي",description:"بيانات اصطناعية فقط",contact_phone:"00000000000"})],
      "public.supplier_ads":[fixtureRow({id:uuid(90),owner_id:user,business_name:"مورد تجريبي",category:"synthetic",title:"إعلان مورد تجريبي",description:"بيانات اصطناعية فقط",contact_phone:"00000000000"})]
    },
    storage_manifest:[
      {synthetic:true,bucket_id:"layan_real_estat",name:"offers/"+user+"/synthetic-offer.jpg",owner_id:user,byte_length:4,transfer_method:"storage-api"},
      {synthetic:true,bucket_id:"layan-property-documents",name:"documents/"+user+"/synthetic-contract.pdf",owner_id:user,byte_length:8,transfer_method:"storage-api"}
    ]
  };
}

function keyOf(value) { return typeof value + ":" + String(value); }

function primaryKey(row, columns, table) {
  const values = columns.map((column) => row[column]);
  if (values.some((value) => value === undefined || value === null || value === "")) {
    throw new Error(table + ": missing primary-key value (" + columns.join(", ") + ")");
  }
  return values.map(keyOf).join("|");
}

function rejectSensitiveFields(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item,index) => rejectSensitiveFields(item,path+"["+index+"]"));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [name,child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(name)) throw new Error(path+": sensitive field '"+name+"' is forbidden");
    rejectSensitiveFields(child,path+"."+name);
  }
}

function orderSelfReferencingAreas(rows) {
  const byId = new Map(rows.map((item) => [keyOf(item.values.id),item]));
  const visited = new Set(), visiting = new Set(), ordered = [];
  function visit(item) {
    const id = keyOf(item.values.id);
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error("public.directory_areas: parent cycle detected");
    visiting.add(id);
    const parent = item.values.parent_id;
    if (parent !== null && parent !== undefined) {
      const parentRow = byId.get(keyOf(parent));
      if (!parentRow) throw new Error("public.directory_areas.parent_id: parent missing from fixture");
      visit(parentRow);
    }
    visiting.delete(id); visited.add(id); ordered.push(item);
  }
  rows.forEach(visit);
  return ordered;
}

function dependencyOrder(tableNames) {
  const nodes = new Set(tableNames);
  const outgoing = new Map([...nodes].map((name) => [name,new Set()]));
  const degree = new Map([...nodes].map((name) => [name,0]));
  for (const [child,,parent] of FOREIGN_KEYS) {
    if (!nodes.has(child) || !nodes.has(parent) || child === parent) continue;
    if (!outgoing.get(parent).has(child)) {
      outgoing.get(parent).add(child);
      degree.set(child,degree.get(child)+1);
    }
  }
  const ready = [...nodes].filter((name) => degree.get(name)===0).sort();
  const result = [];
  while (ready.length) {
    const current = ready.shift();
    result.push(current);
    for (const next of [...outgoing.get(current)].sort()) {
      degree.set(next,degree.get(next)-1);
      if (degree.get(next)===0) { ready.push(next); ready.sort(); }
    }
  }
  if (result.length !== nodes.size) throw new Error("Foreign-key dependency cycle between tables");
  return result;
}

function validateFixture(fixture) {
  if (fixture?.fixture_id !== "ASYUT_AQAR_SYNTHETIC_FIXTURE_V1" || fixture?.classification !== "synthetic-only") {
    throw new Error("Refusing non-synthetic fixture marker");
  }
  if (!fixture.records || typeof fixture.records !== "object" || Array.isArray(fixture.records)) {
    throw new Error("Fixture records must be a table-to-rows object");
  }
  rejectSensitiveFields(fixture,"fixture");

  const counts = {}, orderedRows = {};
  for (const [table,rows] of Object.entries(fixture.records)) {
    if (!Object.hasOwn(TABLES,table)) throw new Error("Table outside reviewed allowlist: "+table);
    if (BLOCKED_TABLES.has(table)) throw new Error("Sensitive table is blocked: "+table);
    if (!Array.isArray(rows)) throw new Error(table+": rows must be an array");
    const seen = new Set();
    for (const [index,item] of rows.entries()) {
      if (item?.synthetic !== true || !item.values || typeof item.values !== "object" || Array.isArray(item.values)) {
        throw new Error(table+"["+index+"]: row must be marked synthetic");
      }
      const id = primaryKey(item.values,TABLES[table],table);
      if (seen.has(id)) throw new Error(table+": duplicate primary key "+id);
      seen.add(id);
      for (const column of TABLES[table]) {
        const value = item.values[column];
        if (typeof value === "string" && value.includes("-") && !value.startsWith(SYNTHETIC_UUID_PREFIX)) {
          throw new Error(table+"."+column+": UUID must use reserved synthetic namespace");
        }
      }
    }
    counts[table] = rows.length;
    orderedRows[table] = table === "public.directory_areas" ? orderSelfReferencingAreas(rows) : rows;
  }

  for (const [childTable,childColumn,parentTable,parentColumn] of FOREIGN_KEYS) {
    const children = fixture.records[childTable] || [];
    const parents = fixture.records[parentTable] || [];
    const parentValues = new Set(parents.map((item) => keyOf(item.values[parentColumn])));
    for (const [index,item] of children.entries()) {
      const reference = item.values[childColumn];
      if (reference === null || reference === undefined) continue;
      if (!parentValues.has(keyOf(reference))) {
        throw new Error(childTable+"["+index+"]."+childColumn+" has no matching "+parentTable+"."+parentColumn);
      }
    }
  }

  const storage = fixture.storage_manifest || [];
  let bytes = 0;
  for (const [index,item] of storage.entries()) {
    if (item?.synthetic !== true) throw new Error("storage_manifest["+index+"] is not synthetic");
    if (!["layan_real_estat","layan-property-documents"].includes(item.bucket_id)) throw new Error("Unapproved Storage bucket");
    if (item.transfer_method !== "storage-api") throw new Error("Storage objects must use Storage API, never SQL");
    if (!Number.isSafeInteger(item.byte_length) || item.byte_length < 0) throw new Error("Invalid Storage byte_length");
    const prefix = item.bucket_id === "layan_real_estat" ? "offers/" : "documents/";
    if (!item.name.startsWith(prefix+item.owner_id+"/")) throw new Error("Storage path is not scoped to its owner");
    if (!item.owner_id.startsWith(SYNTHETIC_UUID_PREFIX)) throw new Error("Storage owner is not a synthetic UUID");
    bytes += item.byte_length;
  }

  const present = Object.keys(fixture.records).filter((table) => fixture.records[table].length > 0);
  return {
    mode:"dry-run-only",
    fixture_id:fixture.fixture_id,
    row_counts:counts,
    total_rows:Object.values(counts).reduce((sum,count)=>sum+count,0),
    dependency_order:dependencyOrder(present),
    area_record_order:orderedRows["public.directory_areas"].map((item)=>item.values.id),
    storage:{objects:storage.length,bytes,transport:"Storage API only; no bytes copied"},
    foreign_key_rules_checked:FOREIGN_KEYS.length,
    preserved_primary_keys:true,
    blocked_tables:[...BLOCKED_TABLES].sort(),
    writes_performed:0
  };
}

function validateTarget(options) {
  if (options.execute) throw new Error("Execution mode is disabled; this utility cannot write to any database");
  if (options.target !== "synthetic-fixture") throw new Error("Target must be exactly synthetic-fixture; hosted targets are unsupported");
  if (!options.confirm) throw new Error("Explicit --confirm-non-production is required");
}

function runSelfTests() {
  const fixture = syntheticFixture();
  const plan = validateFixture(fixture);
  assert.equal(plan.total_rows,21);
  assert.equal(plan.storage.objects,2);
  assert.equal(plan.storage.bytes,12);
  assert.equal(plan.writes_performed,0);
  assert.ok(plan.dependency_order.indexOf("auth.users") < plan.dependency_order.indexOf("auth.identities"));
  assert.ok(plan.dependency_order.indexOf("public.directory_areas") < plan.dependency_order.indexOf("public.directory_entities"));
  assert.ok(plan.dependency_order.indexOf("public.directory_sources") < plan.dependency_order.indexOf("public.directory_entity_sources"));
  assert.deepEqual(plan.area_record_order,[uuid(10),uuid(11)]);

  const orphan = structuredClone(fixture);
  orphan.records["public.directory_sources"] = [];
  assert.throws(()=>validateFixture(orphan),/has no matching public\\.directory_sources\\.id/);
  const duplicate = structuredClone(fixture);
  duplicate.records["public.directory_entities"].push(structuredClone(duplicate.records["public.directory_entities"][0]));
  assert.throws(()=>validateFixture(duplicate),/duplicate primary key/);
  const secret = structuredClone(fixture);
  secret.records["auth.users"][0].values.encrypted_password = "synthetic";
  assert.throws(()=>validateFixture(secret),/sensitive field/);
  const blocked = structuredClone(fixture);
  blocked.records["public.buyer_push_vapid_config"] = [fixtureRow({id:1,public_key:"fake",private_key:"fake"})];
  assert.throws(()=>validateFixture(blocked),/sensitive field|Sensitive table is blocked/);
  const wrongStorage = structuredClone(fixture);
  wrongStorage.storage_manifest[0].transfer_method = "sql";
  assert.throws(()=>validateFixture(wrongStorage),/Storage API/);

  assert.throws(()=>validateTarget({target:"production",confirm:true,execute:false}),/Target must be exactly synthetic-fixture/);
  assert.throws(()=>validateTarget({target:"synthetic-fixture",confirm:false,execute:false}),/Explicit --confirm-non-production/);
  assert.throws(()=>validateTarget({target:"synthetic-fixture",confirm:true,execute:true}),/Execution mode is disabled/);
  return plan;
}

function main() {
  const argv = process.argv.slice(2);
  const selfTest = argv.includes("--self-test");
  const execute = argv.includes("--execute");
  const dryRun = argv.includes("--dry-run");
  const confirm = argv.includes("--confirm-non-production");
  const targetIndex = argv.indexOf("--target");
  const target = targetIndex >= 0 ? argv[targetIndex+1] : null;
  const allowed = new Set(["--self-test","--execute","--dry-run","--confirm-non-production","--target"]);
  for (const arg of argv) if (!allowed.has(arg) && !(targetIndex >= 0 && arg === target)) throw new Error("Unknown argument: "+arg);
  if (targetIndex >= 0 && !target) throw new Error("--target requires a value");

  const plan = runSelfTests();
  if (selfTest) {
    if (execute) throw new Error("--self-test cannot be combined with --execute");
  } else {
    if (!dryRun) throw new Error("Only --dry-run is supported");
    validateTarget({target,confirm,execute});
  }
  console.log(JSON.stringify({
    result:"PASS",
    summary:"Synthetic migration planner checks passed; no database or Storage writes occurred.",
    checks:["synthetic fixture marker","primary-key preservation","duplicate detection","foreign-key completeness","dependency ordering","parent-before-child area ordering","secret-field rejection","Push/VAPID exclusion","Storage API-only manifest","production target refusal","explicit non-production confirmation","execution-mode refusal"],
    plan
  },null,2));
}

try { main(); }
catch (error) { console.error("FAIL: "+error.message); process.exitCode = 1; }
