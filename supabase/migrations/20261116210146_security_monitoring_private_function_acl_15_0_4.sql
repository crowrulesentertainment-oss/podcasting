-- Keep implementation-only trigger/alert helpers non-callable by API roles.
revoke all on function private.cr_security_emit_alert(text,text,text,text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function private.cr_security_failed_login_alert() from public,anon,authenticated;
revoke all on function private.cr_security_admin_activity_alert() from public,anon,authenticated;
