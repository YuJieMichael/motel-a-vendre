-- Isolated Motel operations. Existing main-site tables/functions are not altered.
create table private.motel_metric_rollups (
 day date not null, event text not null check(event in ('page_view','property_view','guide_view','enquiry_open','enquiry_success')),
 language text not null check(language in ('fr','en','zh')), source text not null,
 listing_reference text not null default '', count bigint not null default 1 check(count>0),
 primary key(day,event,language,source,listing_reference)
);
create table private.motel_metric_limits (
 day date not null, client_hash text not null, count integer not null default 1,
 primary key(day,client_hash)
);
create table private.motel_enquiry_receipts (
 enquiry_id uuid primary key references public.enquiries(id) on delete cascade
);
alter table private.motel_metric_rollups enable row level security;
alter table private.motel_metric_limits enable row level security;
alter table private.motel_enquiry_receipts enable row level security;
revoke all on private.motel_metric_rollups,private.motel_metric_limits,private.motel_enquiry_receipts from public,anon,authenticated;

create function public.record_motel_metric(p_event text,p_language text,p_source text,p_reference text,p_client_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare d date := (now() at time zone 'America/Toronto')::date; n integer;
begin
 if p_event not in ('page_view','property_view','guide_view','enquiry_open') or p_language not in ('fr','en','zh')
 or p_source not in ('direct','google','bing','facebook','instagram','linkedin','wechat','xiaohongshu','other','unknown')
 or p_reference is null or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_input'; end if;
 if p_reference<>'' and not exists(select 1 from public.published_listings where listing_number::text=p_reference and property->>'type'='hotel-motel') then return false; end if;
 if p_event='property_view' and p_reference='' then raise exception 'invalid_input'; end if;
 delete from private.motel_metric_limits where day<d-2;
 insert into private.motel_metric_limits(day,client_hash) values(d,p_client_hash)
 on conflict(day,client_hash) do update set count=motel_metric_limits.count+1 returning count into n;
 if n>500 then return false; end if;
 insert into private.motel_metric_rollups(day,event,language,source,listing_reference) values(d,p_event,p_language,p_source,p_reference)
 on conflict(day,event,language,source,listing_reference) do update set count=motel_metric_rollups.count+1;
 return true;
end $$;
revoke all on function public.record_motel_metric(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_motel_metric(text,text,text,text,text) to service_role;

create function public.collect_motel_enquiry(p_id uuid,p_payload jsonb,p_client_hash text,p_source text default 'unknown')
returns void language plpgsql security definer set search_path='' as $$
declare receipt uuid; ref text := ''; lang text := p_payload->>'language';
begin
 if p_payload->>'propertyType' is distinct from 'hotel-motel' or lang is null or lang not in ('fr','en','zh') then raise exception 'invalid_input'; end if;
 perform public.collect_enquiry(p_id,p_payload,p_client_hash);
 insert into private.motel_enquiry_receipts values(p_id) on conflict do nothing returning enquiry_id into receipt;
 if receipt is null then return; end if;
 select listing_number::text into ref from public.published_listings where listing_number::text=p_payload->>'listingReference' and property->>'type'='hotel-motel';
 insert into private.motel_metric_rollups(day,event,language,source,listing_reference)
 values((now() at time zone 'America/Toronto')::date,'enquiry_success',lang,
 case when p_source in ('direct','google','bing','facebook','instagram','linkedin','wechat','xiaohongshu','other','unknown') then p_source else 'unknown' end,coalesce(ref,''))
 on conflict(day,event,language,source,listing_reference) do update set count=motel_metric_rollups.count+1;
end $$;
revoke all on function public.collect_motel_enquiry(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.collect_motel_enquiry(uuid,jsonb,text,text) to service_role;
