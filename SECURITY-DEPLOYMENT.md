# Administrator authorization — deployed 2026-09-13

The production Supabase migration has been applied to project `vwlevkuhenymqrlhlwdf`.
The only account with `app_metadata.role = admin` is `egami@ceiryu.com`; no customer account has this role.
Ten restrictive RLS policies protect management writes and customer-record reads, in addition to three administrator access policies.

All three Edge Functions were updated in the Supabase dashboard:

- `create-client-user`
- `update-client-login`
- `create-s3-upload-url`

Each validates the caller with `auth.getUser(token)` and requires the administrator role before privileged operations. The two account-management function sources were recovered from the dashboard and added to the repository with formatting condensed.

The frontend is hosted on GitHub Pages at https://egmceiryu.github.io/ar_housing/; AWS S3 stores the assets. The published JavaScript contains the new administrator check. Reloading the pre-existing browser session redirected the admin page to the administrator login.

Validation: all three live function endpoints return HTTP 401 to unauthenticated POST requests. Database verification confirmed the unique administrator, zero customer administrator roles, and ten restrictive policies. Local tests cover browser role checks and Edge Function authorization. No production customer records were created, edited or deleted for testing.

No end-to-end administrator login or real S3 upload was performed; the administrator can sign out and back in to refresh their session.

For a new environment, apply `supabase/migrations/202609130001_admin_authorization.sql` once before publishing the frontend, then deploy the three functions. Do not reapply the migration to this production database: the policies already exist.

Run local checks from the repository root using Node.js 24 or newer:

```
node tests/auth.test.cjs
node tests/edge-auth.test.cjs
```
