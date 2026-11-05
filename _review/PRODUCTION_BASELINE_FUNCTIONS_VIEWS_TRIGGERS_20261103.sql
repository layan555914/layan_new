-- Catalog-derived functions, views and triggers for ASYUT AQAR.

-- Restore table definitions, constraints and indexes first.

-- Do not execute against the existing production project.

CREATE OR REPLACE FUNCTION private.layan_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null
     and exists (select 1 from private.layan_admins a where a.user_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION private.layan_activate_supplier_ad(p_ad_id uuid, p_days integer, p_price numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ad public.supplier_ads%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح: يلزم حساب إدارة معتمد';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'مدة الإعلان يجب أن تكون من يوم إلى 365 يومًا';
  end if;

  if p_price is null or p_price < 0 then
    raise exception 'السعر المتفق عليه غير صحيح';
  end if;

  select * into v_ad
  from public.supplier_ads
  where id = p_ad_id
  for update;

  if not found then
    raise exception 'الإعلان غير موجود';
  end if;

  if v_ad.status <> 'pending' then
    raise exception 'لا يمكن تفعيل إعلان حالته ليست قيد المراجعة';
  end if;

  update public.supplier_ads
  set status = 'active',
      price = p_price,
      requested_price = p_price,
      requested_days = p_days,
      starts_at = now(),
      ends_at = now() + make_interval(days => p_days),
      updated_at = now()
  where id = p_ad_id;

  return jsonb_build_object(
    'success', true,
    'ad_id', p_ad_id,
    'status', 'active',
    'duration_days', p_days,
    'agreed_price_egp', p_price
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.layan_admin_list_company_profiles()
 RETURNS SETOF company_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح: يلزم حساب إدارة معتمد' using errcode = '42501';
  end if;

  return query
  select cp.*
  from public.company_profiles cp
  where cp.status = 'pending'
     or (cp.status = 'active' and cp.update_status = 'pending' and cp.pending_update is not null)
  order by cp.created_at asc;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.layan_admin_review_property_offer(p_id bigint, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مسموح' using errcode = '42501';
  end if;

  if p_action not in ('approve','reject') then
    raise exception 'إجراء غير صالح';
  end if;

  if p_action = 'reject' and coalesce(length(trim(p_notes)),0) < 3 then
    raise exception 'اكتب سببًا واضحًا للرفض';
  end if;

  update public.property_offers
  set status = case when p_action = 'approve' then 'available' else status end,
      verification_status = case when p_action = 'approve' then 'verified' else 'rejected' end,
      verification_notes = case when p_action = 'approve' then null else left(trim(p_notes),500) end,
      verified_at = case when p_action = 'approve' then now() else null end
  where id = p_id
    and status = 'pending'
    and verification_status in ('pending','under_review');

  if not found then
    raise exception 'الإعلان غير موجود أو تمت مراجعته بالفعل';
  end if;
end
$function$
;

CREATE OR REPLACE FUNCTION public.layan_is_http_url(u text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select u is null or u = '' or u ~* '^https?://[^[:space:]]+$'
$function$
;

CREATE OR REPLACE FUNCTION public.layan_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.layan_is_admin();
$function$
;

CREATE OR REPLACE FUNCTION public.layan_all_http_urls(arr text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(bool_and(public.layan_is_http_url(x)), true) from unnest(arr) as x
$function$
;

CREATE OR REPLACE FUNCTION public.guard_company_owner_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare k text;
begin
  if auth.uid() is null or public.layan_is_admin() then return new; end if;
  new.id := old.id; new.owner_id := old.owner_id; new.created_at := old.created_at;
  new.reviewed_at := old.reviewed_at; new.reviewed_by := old.reviewed_by;
  if old.status = 'active' then
    -- ملف منشور: لا تُمس الأعمدة العامة ولا الحالة؛ المسموح فقط إرسال pending_update
    if new.pending_update is null or jsonb_typeof(new.pending_update) <> 'object' then
      raise exception 'يجب إرسال التعديلات كنسخة مقترحة (pending_update)' using errcode = '23514';
    end if;
    for k in select jsonb_object_keys(new.pending_update) loop
      if k not in ('company_name','category','description','services','city','address','phone','whatsapp','website','logo_url','gallery_urls','projects') then
        raise exception 'حقل غير مسموح في التعديل المقترح: %', k using errcode = '23514';
      end if;
    end loop;
    if not public.layan_is_http_url(new.pending_update->>'website')
       or not public.layan_is_http_url(new.pending_update->>'logo_url') then
      raise exception 'الروابط يجب أن تبدأ بـ http:// أو https://' using errcode = '23514';
    end if;
    new.company_name := old.company_name; new.category := old.category; new.description := old.description;
    new.services := old.services; new.city := old.city; new.address := old.address; new.phone := old.phone;
    new.whatsapp := old.whatsapp; new.website := old.website; new.logo_url := old.logo_url;
    new.gallery_urls := old.gallery_urls; new.projects := old.projects;
    new.status := 'active'; new.admin_notes := old.admin_notes;
    new.update_status := 'pending'; new.update_notes := null;
  else
    -- pending / needs_changes / rejected: تعديل مباشر وإعادة إرسال للمراجعة
    new.status := 'pending'; new.admin_notes := null;
    new.reviewed_at := null; new.reviewed_by := null;
    new.pending_update := null; new.update_status := null; new.update_notes := null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.directory_require_public_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare has_source boolean := false;
begin
  if new.public_visible and new.verification_status = 'published' then
    if tg_table_name = 'directory_entities' then
      select exists(
        select 1 from public.directory_entity_sources es
        join public.directory_sources s on s.id=es.source_id
        where es.entity_id=new.id and s.is_public
      ) into has_source;
    elsif tg_table_name = 'directory_projects' then
      select exists(
        select 1 from public.directory_project_sources ps
        join public.directory_sources s on s.id=ps.source_id
        where ps.project_id=new.id and s.is_public
      ) into has_source;
    elsif tg_table_name = 'directory_opportunities' then
      select exists(
        select 1 from public.directory_opportunity_sources os
        join public.directory_sources s on s.id=os.source_id
        where os.opportunity_id=new.id and s.is_public
      ) into has_source;
    else
      has_source := true;
    end if;
    if not has_source then
      raise exception 'لا يمكن نشر سجل الدليل دون ربط مصدر عام واحد على الأقل.';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_company_property_ad_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_owner uuid;
  v_status text;
  v_count bigint;
begin
  if new.company_ad_id is null then
    return new;
  end if;

  -- Serialize inserts for this one company ad to prevent concurrent
  -- requests from both observing a count below three.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.company_ad_id::text, 0)
  );

  select c.owner_id, c.status
    into v_owner, v_status
    from public.company_property_ads c
   where c.id = new.company_ad_id;

  if not found then
    raise exception 'إعلان الشركة غير موجود. ابدأ طلب إعلان شركة جديد.';
  end if;

  if v_owner is distinct from new.owner_id then
    raise exception 'لا يمكنك إضافة عقار إلى إعلان شركة لا تملكه.';
  end if;

  if v_status not in ('pending','active') then
    raise exception 'إعلان الشركة غير نشط. أرسل طلب إعلان شركة جديدًا.';
  end if;

  select pg_catalog.count(*)
    into v_count
    from public.property_offers p
   where p.company_ad_id = new.company_ad_id;

  if v_count >= 3 then
    raise exception 'وصل إعلان الشركة إلى الحد الأقصى: 3 عقارات في الإعلان الواحد.';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_layan_offer_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid;
  owned_count integer;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null then
    raise exception 'يلزم تسجيل الدخول قبل إضافة عرض.';
  end if;
  if new.owner_id is distinct from current_user_id then
    raise exception 'لا يمكن إضافة عرض لحساب مستخدم آخر.';
  end if;
  new.status := 'pending';
  select count(*) into owned_count
  from public.property_offers
  where owner_id = current_user_id;
  if owned_count >= 3 then
    raise exception 'وصلت للحد الأقصى: 3 عروض لكل حساب في الفترة التجريبية.';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_property_offer_promotion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin if tg_op = 'INSERT' then new.is_featured := false; new.featured_until := null; if coalesce(new.featured_requested, false) then new.promotion_status := 'requested'; else new.promotion_status := 'none'; end if; end if; return new; end; $function$
;

CREATE OR REPLACE FUNCTION public.layan_activate_supplier_ad(p_ad_id uuid, p_days integer, p_price numeric)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.layan_activate_supplier_ad(p_ad_id, p_days, p_price);
$function$
;

CREATE OR REPLACE FUNCTION public.layan_admin_list_company_profiles()
 RETURNS SETOF company_profiles
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select * from private.layan_admin_list_company_profiles();
$function$
;

CREATE OR REPLACE FUNCTION public.layan_admin_review_property_offer(p_id bigint, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.layan_admin_review_property_offer(p_id, p_action, p_notes);
$function$
;

CREATE OR REPLACE FUNCTION public.layan_approve_free_trial_ad(p_ad_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_ad public.supplier_ads%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح: يلزم حساب إدارة معتمد';
  end if;

  select * into v_ad
  from public.supplier_ads
  where id = p_ad_id
  for update;

  if not found then
    raise exception 'الإعلان غير موجود';
  end if;
  if v_ad.status <> 'pending' then
    raise exception 'لا يمكن اعتماد إعلان حالته ليست قيد المراجعة';
  end if;
  if v_ad.plan_code <> 'trial_30' or v_ad.requested_days <> 30 or v_ad.requested_price <> 0 then
    raise exception 'هذه العملية مخصصة للتجربة المجانية فقط';
  end if;

  update public.supplier_ads
  set status = 'active',
      price = 0,
      starts_at = now(),
      ends_at = now() + interval '30 days',
      free_trial_started_at = now(),
      free_trial_ends_at = now() + interval '30 days',
      updated_at = now()
  where id = p_ad_id;

  return jsonb_build_object('success', true, 'ad_id', p_ad_id, 'status', 'active', 'trial_days', 30);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.layan_reject_supplier_ad(p_ad_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from private.layan_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح: يلزم حساب إدارة معتمد';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 or length(p_reason) > 500 then
    raise exception 'اكتب سبب رفض واضحًا';
  end if;
  update public.supplier_ads
  set status = 'rejected', updated_at = now()
  where id = p_ad_id and status = 'pending';
  if not found then
    raise exception 'الإعلان غير موجود أو ليس قيد المراجعة';
  end if;
  return jsonb_build_object('success', true, 'ad_id', p_ad_id, 'status', 'rejected');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.layan_review_company_profile(p_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.company_profiles; d jsonb;
begin
  if not public.layan_is_admin() then raise exception 'غير مسموح' using errcode = '42501'; end if;
  select * into r from public.company_profiles where id = p_id for update;
  if not found or r.status <> 'active' or r.update_status is distinct from 'pending' or r.pending_update is null then
    raise exception 'لا يوجد تعديل معلّق لهذا الملف';
  end if;
  d := r.pending_update;
  if p_action = 'approve' then
    update public.company_profiles set
      company_name = coalesce(nullif(d->>'company_name',''), company_name),
      category     = coalesce(nullif(d->>'category',''), category),
      description  = coalesce(nullif(d->>'description',''), description),
      services     = case when jsonb_typeof(d->'services') = 'array' then array(select jsonb_array_elements_text(d->'services')) else services end,
      city         = coalesce(nullif(d->>'city',''), city),
      address      = case when d ? 'address'  then nullif(d->>'address','')  else address end,
      phone        = coalesce(nullif(d->>'phone',''), phone),
      whatsapp     = case when d ? 'whatsapp' then nullif(d->>'whatsapp','') else whatsapp end,
      website      = case when d ? 'website'  then nullif(d->>'website','')  else website end,
      logo_url     = case when d ? 'logo_url' then nullif(d->>'logo_url','') else logo_url end,
      gallery_urls = case when jsonb_typeof(d->'gallery_urls') = 'array' then array(select jsonb_array_elements_text(d->'gallery_urls')) else gallery_urls end,
      projects     = case when jsonb_typeof(d->'projects') = 'array' then d->'projects' else projects end,
      pending_update = null, update_status = null, update_notes = null, admin_notes = null,
      reviewed_at = now(), reviewed_by = auth.uid()
    where id = p_id;
  elsif p_action in ('request_changes','reject') then
    if coalesce(trim(p_notes),'') = '' then raise exception 'الملاحظات مطلوبة'; end if;
    update public.company_profiles set
      update_status = case p_action when 'request_changes' then 'needs_changes' else 'rejected' end,
      update_notes = left(trim(p_notes), 500)
    where id = p_id;
  else
    raise exception 'إجراء غير صالح';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_company_profiles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_supplier_ad_free_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.free_trial_started_at := now();
  new.free_trial_ends_at := now() + interval '30 days';
  return new;
end;
$function$
;

-- Recreate explicit function EXECUTE grants.

REVOKE ALL ON FUNCTION private.layan_is_admin() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.layan_is_admin() TO PUBLIC;

GRANT EXECUTE ON FUNCTION private.layan_is_admin() TO authenticated;

REVOKE ALL ON FUNCTION private.layan_activate_supplier_ad(uuid,integer,numeric) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.layan_activate_supplier_ad(uuid,integer,numeric) TO authenticated;

REVOKE ALL ON FUNCTION private.layan_admin_list_company_profiles() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.layan_admin_list_company_profiles() TO PUBLIC;

GRANT EXECUTE ON FUNCTION private.layan_admin_list_company_profiles() TO authenticated;

REVOKE ALL ON FUNCTION private.layan_admin_review_property_offer(bigint,text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.layan_admin_review_property_offer(bigint,text,text) TO authenticated;

REVOKE ALL ON FUNCTION layan_is_http_url(text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_is_http_url(text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION layan_is_http_url(text) TO anon;

GRANT EXECUTE ON FUNCTION layan_is_http_url(text) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_is_http_url(text) TO service_role;

REVOKE ALL ON FUNCTION layan_is_admin() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_is_admin() TO authenticated;

GRANT EXECUTE ON FUNCTION layan_is_admin() TO service_role;

REVOKE ALL ON FUNCTION layan_all_http_urls(text[]) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_all_http_urls(text[]) TO PUBLIC;

GRANT EXECUTE ON FUNCTION layan_all_http_urls(text[]) TO anon;

GRANT EXECUTE ON FUNCTION layan_all_http_urls(text[]) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_all_http_urls(text[]) TO service_role;

REVOKE ALL ON FUNCTION guard_company_owner_update() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION guard_company_owner_update() TO PUBLIC;

GRANT EXECUTE ON FUNCTION guard_company_owner_update() TO anon;

GRANT EXECUTE ON FUNCTION guard_company_owner_update() TO authenticated;

GRANT EXECUTE ON FUNCTION guard_company_owner_update() TO service_role;

REVOKE ALL ON FUNCTION directory_require_public_source() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION directory_require_public_source() TO PUBLIC;

GRANT EXECUTE ON FUNCTION directory_require_public_source() TO anon;

GRANT EXECUTE ON FUNCTION directory_require_public_source() TO authenticated;

GRANT EXECUTE ON FUNCTION directory_require_public_source() TO service_role;

REVOKE ALL ON FUNCTION enforce_company_property_ad_limit() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION enforce_company_property_ad_limit() TO PUBLIC;

GRANT EXECUTE ON FUNCTION enforce_company_property_ad_limit() TO anon;

GRANT EXECUTE ON FUNCTION enforce_company_property_ad_limit() TO authenticated;

GRANT EXECUTE ON FUNCTION enforce_company_property_ad_limit() TO service_role;

REVOKE ALL ON FUNCTION enforce_layan_offer_limit() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION enforce_layan_offer_limit() TO PUBLIC;

GRANT EXECUTE ON FUNCTION enforce_layan_offer_limit() TO anon;

GRANT EXECUTE ON FUNCTION enforce_layan_offer_limit() TO authenticated;

GRANT EXECUTE ON FUNCTION enforce_layan_offer_limit() TO service_role;

REVOKE ALL ON FUNCTION guard_property_offer_promotion() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION guard_property_offer_promotion() TO PUBLIC;

GRANT EXECUTE ON FUNCTION guard_property_offer_promotion() TO anon;

GRANT EXECUTE ON FUNCTION guard_property_offer_promotion() TO authenticated;

GRANT EXECUTE ON FUNCTION guard_property_offer_promotion() TO service_role;

REVOKE ALL ON FUNCTION layan_activate_supplier_ad(uuid,integer,numeric) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_activate_supplier_ad(uuid,integer,numeric) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_activate_supplier_ad(uuid,integer,numeric) TO service_role;

REVOKE ALL ON FUNCTION layan_admin_list_company_profiles() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_admin_list_company_profiles() TO authenticated;

GRANT EXECUTE ON FUNCTION layan_admin_list_company_profiles() TO service_role;

REVOKE ALL ON FUNCTION layan_admin_review_property_offer(bigint,text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_admin_review_property_offer(bigint,text,text) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_admin_review_property_offer(bigint,text,text) TO service_role;

REVOKE ALL ON FUNCTION layan_approve_free_trial_ad(uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_approve_free_trial_ad(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_approve_free_trial_ad(uuid) TO service_role;

REVOKE ALL ON FUNCTION layan_reject_supplier_ad(uuid,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_reject_supplier_ad(uuid,text) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_reject_supplier_ad(uuid,text) TO service_role;

REVOKE ALL ON FUNCTION layan_review_company_profile(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION layan_review_company_profile(uuid,text,text) TO authenticated;

GRANT EXECUTE ON FUNCTION layan_review_company_profile(uuid,text,text) TO service_role;

REVOKE ALL ON FUNCTION set_company_profiles_updated_at() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION set_company_profiles_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION set_company_profiles_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION set_company_profiles_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION set_company_profiles_updated_at() TO service_role;

REVOKE ALL ON FUNCTION set_supplier_ad_free_trial() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION set_supplier_ad_free_trial() TO PUBLIC;

GRANT EXECUTE ON FUNCTION set_supplier_ad_free_trial() TO anon;

GRANT EXECUTE ON FUNCTION set_supplier_ad_free_trial() TO authenticated;

GRANT EXECUTE ON FUNCTION set_supplier_ad_free_trial() TO service_role;

-- Security-invoker views.

CREATE OR REPLACE VIEW "public"."company_profiles_public" WITH (security_invoker=true) AS
 SELECT id,
    company_name,
    category,
    description,
    services,
    city,
    logo_url
   FROM company_profiles
  WHERE status = 'active'::text;;

CREATE OR REPLACE VIEW "public"."public_active_supplier_ads" WITH (security_invoker=true) AS
 SELECT id,
    business_name,
    category,
    title,
    description,
    image_url,
    target_url,
    contact_phone,
    created_at
   FROM supplier_ads
  WHERE status = 'active'::text;;

-- Application triggers.

CREATE TRIGGER company_profiles_owner_update_guard BEFORE UPDATE ON "public"."company_profiles" FOR EACH ROW EXECUTE FUNCTION guard_company_owner_update();

CREATE TRIGGER company_profiles_set_updated_at BEFORE UPDATE ON "public"."company_profiles" FOR EACH ROW EXECUTE FUNCTION set_company_profiles_updated_at();

CREATE TRIGGER directory_entities_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_entities" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();

CREATE TRIGGER directory_opportunities_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_opportunities" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();

CREATE TRIGGER directory_projects_require_source BEFORE INSERT OR UPDATE OF public_visible, verification_status ON "public"."directory_projects" FOR EACH ROW EXECUTE FUNCTION directory_require_public_source();

CREATE TRIGGER a_property_offer_promotion_guard BEFORE INSERT ON "public"."property_offers" FOR EACH ROW EXECUTE FUNCTION guard_property_offer_promotion();

CREATE TRIGGER c_property_offer_company_limit BEFORE INSERT ON "public"."property_offers" FOR EACH ROW EXECUTE FUNCTION enforce_company_property_ad_limit();
