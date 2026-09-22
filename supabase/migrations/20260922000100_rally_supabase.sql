create extension if not exists pg_cron;
create schema if not exists private;

create table if not exists public.rallies_current(
  id integer primary key default 1 check(id=1), rally_id text not null, title text not null,
  subtitle text not null default '', theme jsonb not null, active_tribe_ids jsonb not null default '[]',
  current_week integer not null default 1, total_weeks integer not null default 10,
  finalized boolean not null default false, final_ranking jsonb not null default '[]',
  finalized_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.missions(
  week integer primary key, title text not null default '', body text not null default '',
  finalized boolean not null default false, items jsonb not null default '[]', updated_at timestamptz not null default now()
);
create table if not exists public.people(
  id text primary key, kind text not null check(kind in('worker','youth')), name text not null,
  church text not null default '', whatsapp text not null default '', tribe_id text,
  status text not null default 'active' check(status in('active','away')), score integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.attendance(
  id text primary key, person_id text not null references public.people(id) on delete cascade,
  week integer not null, meeting text not null check(meeting in('encontro','algo_mais')), present boolean not null,
  guests integer not null default 0, returned boolean not null default false, justification text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.weekly_scores(
  tribe_id text not null, week integer not null, points integer not null default 0,
  submitted boolean not null default false, submitted_at timestamptz, details jsonb not null default '{}',
  primary key(tribe_id,week)
);
create table if not exists public.announcements(
  id uuid primary key default gen_random_uuid(), title text not null, body text not null, created_at timestamptz not null default now()
);
create table if not exists public.system_control(
  id integer primary key default 1 check(id=1), submission_open boolean not null default false,
  system_locked boolean not null default false, locked_until timestamptz, last_closed_week integer,
  updated_at timestamptz not null default now()
);
create table if not exists public.rally_archives(
  id uuid primary key default gen_random_uuid(), payload jsonb not null, archived_at timestamptz not null default now()
);
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade, role text not null default 'viewer' check(role in('admin','leader','viewer')),
  tribe_id text, church text, email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function private.is_rally_admin() returns boolean language sql security definer set search_path='' stable as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
create or replace function private.is_rally_leader() returns boolean language sql security definer set search_path='' stable as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='leader');
$$;
create or replace function private.current_leader_tribe() returns text language sql security definer set search_path='' stable as $$
  select tribe_id from public.profiles where id=(select auth.uid());
$$;
create or replace function private.handle_new_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,role,email) values(new.id,case when lower(coalesce(new.email,''))='admin@rallyfju.com' then 'admin' else 'viewer' end,new.email)
  on conflict(id) do update set email=excluded.email,updated_at=now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_auth_user();

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on function private.is_rally_admin() from public;
revoke execute on function private.is_rally_leader() from public;
revoke execute on function private.current_leader_tribe() from public;
grant execute on function private.is_rally_admin(),private.is_rally_leader(),private.current_leader_tribe() to authenticated;

insert into public.system_control(id) values(1) on conflict(id) do nothing;
insert into public.rallies_current(id,rally_id,title,subtitle,theme,active_tribe_ids,current_week,total_weeks,finalized,final_ranking)
values(1,'rally-atual','RALLY FJU','Só os valentes fazem a diferença!','{"primary":"#103d8f","secondary":"#071d46","accent":"#f4b400"}','["aser","benjamin","efraim","gade","issacar","juda","levi","manasses","naftali","rubens","simeao","zebulom"]',1,10,false,'[]')
on conflict(id) do nothing;
insert into public.missions(week,title) select g,'Missão da Semana '||g from generate_series(1,10) g on conflict(week) do nothing;

alter table public.rallies_current enable row level security;
alter table public.missions enable row level security;
alter table public.people enable row level security;
alter table public.attendance enable row level security;
alter table public.weekly_scores enable row level security;
alter table public.announcements enable row level security;
alter table public.system_control enable row level security;
alter table public.rally_archives enable row level security;
alter table public.profiles enable row level security;

revoke all on public.rallies_current,public.missions,public.people,public.attendance,public.weekly_scores,public.announcements,public.system_control,public.rally_archives,public.profiles from anon,authenticated;
grant select on public.rallies_current,public.missions,public.weekly_scores,public.announcements,public.system_control to anon,authenticated;
grant select,insert,update,delete on public.rallies_current,public.missions,public.people,public.attendance,public.weekly_scores,public.announcements,public.rally_archives,public.profiles to authenticated;

create policy "public read rally" on public.rallies_current for select to anon,authenticated using(true);
create policy "admin manage rally" on public.rallies_current for all to authenticated using((select private.is_rally_admin())) with check((select private.is_rally_admin()));
create policy "public read missions" on public.missions for select to anon,authenticated using(true);
create policy "admin manage missions" on public.missions for all to authenticated using((select private.is_rally_admin())) with check((select private.is_rally_admin()));
create policy "admin manage people" on public.people for all to authenticated using((select private.is_rally_admin())) with check((select private.is_rally_admin()));
create policy "admin manage attendance" on public.attendance for all to authenticated using((select private.is_rally_admin())) with check((select private.is_rally_admin()));
create policy "public read scores" on public.weekly_scores for select to anon,authenticated using(true);
create policy "admin manage scores" on public.weekly_scores for all to authenticated using((select private.is_rally_admin())) with check((select private.is_rally_admin()));
create policy "leader insert current score" on public.weekly_scores for insert to authenticated with check(
  (select private.is_rally_leader()) and tribe_id=(select private.current_leader_tribe())
  and week=(select current_week from public.rallies_current where id=1)
  and exists(select 1 from public.system_control where id=1 and submission_open and not system_locked)
  and extract(isodow from(now() at time zone 'America/Sao_Paulo'))=7
  and (now() at time zone 'America/Sao_Paulo')::time>=time '16:00'
  and (now() at time zone 'America/Sao_Paulo')::time<time '19:00'
);
create policy "leader update current score" on public.weekly_scores for update to authenticated using(
  (select private.is_rally_leader()) and tribe_id=(select private.current_leader_tribe()) and week=(select current_week from public.rallies_current where id=1)
) with check(
  (select private.is_rally_leader()) and tribe_id=(select private.current_leader_tribe())
  and week=(select current_week from public.rallies_current where id=1)
  and exists(select 1 from public.system_control where id=1 and submission_open and not system_locked)
  and extract(isodow from(now() at time zone 'America/Sao_Paulo'))=7
  and (now() at time zone 'America/Sao_Paulo')::time>=time '16:00'
  and (now() at time zone 'America/Sao_Paulo')::time<time '19:00'
);
create policy "public read announcements" on public.announcements for select to anon,authenticated using(true);
create policy "admin manage announcements" on public.announcements for all to authenticated using((select private.is_rally_admin())) with check((select private.is_rally_admin()));
create policy "public read control" on public.system_control for select to anon,authenticated using(true);
create policy "admin read archives" on public.rally_archives for select to authenticated using((select private.is_rally_admin()));
create policy "admin create archives" on public.rally_archives for insert to authenticated with check((select private.is_rally_admin()));
create policy "user read profile" on public.profiles for select to authenticated using(id=(select auth.uid()) or (select private.is_rally_admin()));
create policy "admin manage profiles" on public.profiles for all to authenticated using((select private.is_rally_admin())) with check((select private.is_rally_admin()));

create index if not exists people_tribe_idx on public.people(tribe_id);
create index if not exists attendance_person_week_idx on public.attendance(person_id,week);
create index if not exists scores_week_tribe_idx on public.weekly_scores(week,tribe_id);

do $$
declare j bigint;
begin
  for j in select jobid from cron.job where jobname in('rally-open-sunday','rally-close-sunday','rally-unlock-monday') loop perform cron.unschedule(j); end loop;
  perform cron.schedule('rally-open-sunday','0 19 * * 0',$open$update public.system_control set submission_open=true,system_locked=false,updated_at=now() where id=1 and exists(select 1 from public.rallies_current where id=1 and not finalized);$open$);
  perform cron.schedule('rally-close-sunday','0 22 * * 0',$close$insert into public.weekly_scores(tribe_id,week,points,submitted,submitted_at,details)
    select tribe_id,current_week,0,false,now(),jsonb_build_object('reason','Fechamento automático sem lançamento até 19h.')
    from public.rallies_current cross join jsonb_array_elements_text(active_tribe_ids) tribe_id
    where id=1 and not finalized on conflict(tribe_id,week) do nothing;
    update public.system_control set submission_open=false,system_locked=true,last_closed_week=(select current_week from public.rallies_current where id=1),locked_until=date_trunc('day',now())+interval '1 day 10 hours',updated_at=now() where id=1;$close$);
  perform cron.schedule('rally-unlock-monday','0 10 * * 1',$unlock$update public.system_control set submission_open=false,system_locked=false,locked_until=null,updated_at=now() where id=1;$unlock$);
end $$;

do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['rallies_current','missions','people','attendance','weekly_scores','announcements','system_control'] loop
      begin execute format('alter publication supabase_realtime add table public.%I',t); exception when duplicate_object then null; end;
    end loop;
  end if;
end $$;
