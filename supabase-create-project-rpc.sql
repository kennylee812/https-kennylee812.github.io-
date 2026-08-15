-- Run once in Supabase Dashboard -> SQL Editor.
-- Creates projects for the current authenticated user without changing table ownership.

create or replace function public.create_project(
  project_name text,
  project_data jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_project_id bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.projects (name, data, owner_id)
  values (project_name, project_data, current_user_id)
  returning id into new_project_id;

  return new_project_id;
end;
$$;

revoke all on function public.create_project(text, jsonb) from public;
grant execute on function public.create_project(text, jsonb) to authenticated;
