-- Keep the Auth signup trigger functional while preventing direct API calls to
-- this privileged trigger function.
alter function public.handle_new_user() set search_path = '';

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
