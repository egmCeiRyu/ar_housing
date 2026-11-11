# QRIE Asset Manager — deployed

Admin page: https://qrie.ceiryu.workers.dev/asset-manager

## Implementation

- Reuses QRIE administrator authentication and existing Supabase/AWS configuration.
- Migrations `202611110001_asset_manager.sql` and `202611110002_asset_s3_prefix.sql` applied to QRIE project `vwlevkuhenymqrlhlwdf`.
- Dedicated tables: `asset_categories`, `assets`, `project_assets`. Only the new library tables/policies were changed. `project_assets` references QRIE `properties`.
- Dedicated `manage-assets` function validates tokens through Supabase Auth and requires the administrator app role. An authenticated customer cannot manage the global library. Legacy gateway JWT verification is off because authentication is performed in the function, matching the existing custom-auth functions.
- The original `create-s3-upload-url` function is unchanged. New library uploads reuse its existing S3 namespace/configuration under `clients/asset-library/{furniture|textures}/{uuid}/` with unique keys.
- GLB originals and PNG/JPEG/WebP texture originals are preserved. A 512px WebP thumbnail is generated once in the browser. Original model transforms are preserved; bottom-center pivot offset and physical dimensions are metadata.
- Project availability is stored but not yet connected to the buyer editor. No QR, AR or Character AR application behavior was changed.

## Access model

Library administration and metadata reads require the existing administrator account. PUT URLs expire after five minutes and the admin UI uses GET URLs valid for one hour. No AWS or service-role secret is exposed in the frontend.

The existing S3 object-read policy is public. Actual unsigned HEAD checks returned 200 for the newly uploaded original GLB and thumbnail. Signed GET URLs do not make these files private. The manager therefore uses 有効 / 無効 (enabled/disabled), not privacy labels. Disabling an asset controls its catalog availability, not direct S3 download access. Restricting object reads would require a separate, reviewed bucket-policy change; no IAM or bucket policy was changed for this implementation.

## Free-plan usage

Uploads go directly from browser to S3, never through Supabase Storage. Supabase stores metadata only. No Realtime, polling or scheduled jobs were introduced. Listing uses 24 assets per page and 500ms debounced search. A conservative 2,000-row catalog guard also counts archived drafts.

Measured total size of the three library tables, including their indexes, was 168 kB after the initial model/availability tests. This is a point-in-time measurement, not a guarantee of future account usage. Existing organization quotas were far below their limits before deployment.

## Validation

Node 24 checks passed:

```
node tests/auth.test.cjs
node tests/edge-auth.test.cjs
node tests/assets-auth.test.cjs
node tests/asset-preview.test.mjs
```

Coverage: 7 existing browser authorization cases, 15 existing Edge authorization cases, 27 library authorization/origin/method cases, pivot bottom-center, physical size, nested transforms and orientation preservation. Live anonymous function invocation and metadata reads return 401.

Live browser checks passed: GLB upload, automatic dimensions and thumbnail, metadata editing, activation/deactivation, project assignment persistence, safe archive and restore. The existing TV GLB and corrected white wallpaper texture were registered as initial review samples. They are disabled and have no enabled project assignments. Failed diagnostic draft records are archived, not permanently deleted. Incomplete drafts cannot be restored as completed assets.

The actual HTML/CSS was also rendered in an isolated 390px iframe: viewport and page width both 390px (no horizontal overflow). This is a layout check, not a physical iPhone test. Local layout fixtures contain no authentication or database calls.

## Publication

`node stage-ar-preview.mjs` stages root HTML, css, js and vendor files. It excludes the test fixtures and Supabase sources. Backend functions/migrations deploy separately. Original asset folders are not included in Git. The S3 error in the initial `qrie-assets` path was resolved by using the existing `clients/` namespace; no AWS console login or extra IAM permission was needed.
