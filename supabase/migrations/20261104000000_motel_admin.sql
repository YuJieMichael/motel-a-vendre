-- Motel staff workspace (motelavendre.ca/admin/).
-- Staff are the existing Propriété En Vente staff (private.is_staff(): active owner/operator, confirmed email).
-- Only enquiries recorded in private.motel_enquiry_receipts are visible here. Main-site functions are not altered.

-- Used by the Motel Worker to authorize /api/admin/* with the caller's own access token:
-- 'owner' or 'operator' for verified staff, null for everyone else.
create function public.motel_staff_role()
returns text language sql stable security definer set search_path='' as $$
 select s.role from public.staff_members s where s.user_id=auth.uid() and private.is_staff();
$$;
revoke all on function public.motel_staff_role() from public,anon;
grant execute on function public.motel_staff_role() to authenticated;

-- Team list for the owner's "Invite a member" screen. Appointments themselves keep using the
-- main site's invite-staff function (appoint_existing_staff), unchanged.
create function public.motel_staff_members()
returns table(email text,role text,active boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.staff_members s where s.user_id=auth.uid() and s.role='owner' and s.active) or not private.is_staff() then
  raise exception 'owner_required' using errcode='42501'; end if;
 return query select u.email::text,s.role,s.active,s.created_at from public.staff_members s join auth.users u on u.id=s.user_id
 order by (s.role='owner') desc,s.created_at;
end $$;
revoke all on function public.motel_staff_members() from public,anon;
grant execute on function public.motel_staff_members() to authenticated;

create function public.list_motel_enquiries(p_filter text default 'active',p_offset integer default 0)
returns table(id uuid,created_at timestamptz,payload jsonb,review_status text,deleted_at timestamptz,revision integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501'; end if;
 if p_filter is null or p_filter not in ('active','pending','accepted','deleted') or p_offset is null or p_offset<0 then raise exception 'invalid_filter' using errcode='22023'; end if;
 return query select e.id,e.created_at,e.payload||coalesce(e.listing_context,'{}'::jsonb),e.review_status,e.deleted_at,e.revision
 from public.enquiries e join private.motel_enquiry_receipts r on r.enquiry_id=e.id
 where (case when p_filter='deleted' then e.deleted_at is not null else e.deleted_at is null and (p_filter='active' or e.review_status=p_filter) end)
 order by e.created_at desc,e.id desc limit 51 offset p_offset;
end $$;

create function public.review_motel_enquiry(p_id uuid,p_revision integer,p_action text)
returns table(id uuid,review_status text,deleted_at timestamptz,revision integer)
language plpgsql security definer set search_path='' as $$
declare e public.enquiries; previous_status text;
begin
 if not private.is_staff() then raise exception 'verified_staff_required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('accept','reopen','delete','restore') then raise exception 'invalid_action' using errcode='22023'; end if;
 select q.* into e from public.enquiries q join private.motel_enquiry_receipts r on r.enquiry_id=q.id where q.id=p_id for update of q;
 if not found then raise exception 'enquiry_not_found' using errcode='P0002'; end if;
 if p_revision is distinct from e.revision then raise exception 'revision_conflict' using errcode='40001'; end if;
 if e.deleted_at is not null and p_action in ('accept','reopen') then raise exception 'restore_first' using errcode='22023'; end if;
 previous_status=e.review_status;
 update public.enquiries q set
 review_status=case p_action when 'accept' then 'accepted' when 'reopen' then 'pending' else q.review_status end,
 deleted_at=case p_action when 'delete' then coalesce(q.deleted_at,now()) when 'restore' then null else q.deleted_at end,
 revision=q.revision+1 where q.id=p_id returning q.* into e;
 insert into public.audit_events(actor_id,action,metadata) values(auth.uid(),'motel_enquiry_'||p_action,
 jsonb_build_object('enquiry_id',p_id,'previous_status',previous_status,'status',e.review_status,'revision',e.revision,'site','motelavendre.ca'));
 return query select e.id,e.review_status,e.deleted_at,e.revision;
end $$;
revoke all on function public.list_motel_enquiries(text,integer),public.review_motel_enquiry(uuid,integer,text) from public,anon;
grant execute on function public.list_motel_enquiries(text,integer),public.review_motel_enquiry(uuid,integer,text) to authenticated;
