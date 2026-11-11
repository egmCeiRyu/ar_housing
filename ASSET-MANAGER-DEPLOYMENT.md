# QRIE Asset Manager

## Status

- Admin page: https://qrie.ceiryu.workers.dev/asset-manager
- Migration `202611110001_asset_manager.sql` applied to QRIE project `vwlevkuhenymqrlhlwdf`.
- New `manage-assets` function deployed. It verifies the access token through Supabase Auth and requires `app_metadata.role=admin`.
- Legacy gateway JWT verification is off for this function, as for the existing custom-auth functions. Backend authentication remains required.
- Upload currently blocked: Amazon S3 returns HTTP 403 `AccessDenied` for the new `qrie-assets/` namespace. AWS administrator sign-in is required to inspect the uploader identity permissions and any explicit deny.
- Do not grant public access. The new library uses signed GET URLs valid for one hour and PUT URLs valid for five minutes.

## Minimum AWS scope

Review `supabase/functions/manage-assets/s3-permissions.json` for the existing uploader identity. It permits only GetObject (including HeadObject) and PutObject in the new `qrie-assets/*` prefix. It grants no delete, list, bucket administration or IAM administration permissions. Existing IAM/bucket policy explicit denies, if present, require review separately.

Do not change existing object prefixes or access policies for Character AR. Verify an uploaded library object's unsigned URL returns 403 before claiming files are private. Signed URLs alone do not override public bucket policies.

## Storage and usage

GLB originals, texture originals and WebP thumbnails are uploaded directly from the browser to S3. Supabase stores metadata only. There is no Realtime subscription, scheduled polling or binary content in Supabase Storage. Listing is paginated at 24 assets with debounced search. The backend has an initial 2,000-row catalog guard; archived drafts also count. This is a conservative guard, not a guarantee about future account usage.

The existing Character AR application, tables, policies, authentication and functions were not changed. `project_assets` references QRIE `properties` only. Buyers are not connected to this library yet.

## Checks

Using Node 24:

```
node tests/auth.test.cjs
node tests/edge-auth.test.cjs
node tests/assets-auth.test.cjs
node tests/asset-preview.test.mjs
```

Passed: 7 existing browser authorization cases, 15 existing Edge authorization cases, 27 new asset authorization/origin/method cases, pivot center-bottom/size/nested transform/orientation preservation. Anonymous live `manage-assets` POST returns 401.

Browser preview tested with the original TV GLB: dimensions detected, original orientation retained, 512px WebP thumbnail generated (4,428 bytes). A recursive orbit redraw was fixed and visually verified. Real S3 registration remains pending AWS permissions; do not report end-to-end upload success yet.

## Publication

`node stage-ar-preview.mjs` includes HTML, css, js and vendor assets. `tests/` and `supabase/` are not staged as public static assets by this script. The backend is deployed separately. Original model files are not included in Git.
