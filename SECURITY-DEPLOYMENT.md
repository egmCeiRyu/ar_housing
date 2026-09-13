# Administrator authorization

Local changes require deployment before they protect the live site.

1. Back up and inspect the live RLS policies. Apply `supabase/migrations/202609130001_admin_authorization.sql` through the Supabase SQL editor. It assigns `app_metadata.role = admin` to the existing `egami@ceiryu.com` account and restricts writes to clients, properties and project colors. Existing public AR reads and analytics writes remain subject to their existing policies.
2. The deployed `create-client-user` and `update-client-login` functions must validate the caller using `auth.getUser(token)` and require `user.app_metadata.role === "admin"` BEFORE using service-role credentials. Their source is absent from this repository: retrieve and audit it before considering the production fix complete.
3. Deploy the modified `create-s3-upload-url` function. It now validates the token itself, including when gateway JWT verification is disabled.
4. Publish the changed HTML and JavaScript files to the existing AWS site and invalidate any CDN cache. Sign out and sign in again as administrator.
5. Verify a customer cannot log into admin, open admin URLs directly, modify rows through REST, request S3 upload URLs, or invoke either account-management function. Verify the administrator can perform these actions. Verify the customer portal and public AR still work.

The browser checks are usability guards; RLS and server checks enforce authorization. Do not use `user_metadata` for roles: users can edit it. Never put a service-role key in the website.

Live database policies, deployed account-management functions and AWS deployment were not available for verification in this local change. The SQL is prepared, not yet applied.
