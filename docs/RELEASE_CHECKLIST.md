# Tahir Tracker — Production Release & Migration Checklist

Use this checklist to track production readiness, live Supabase migration, and mobile deployments.

---

### Step 1: Pre-Flight Automated Verification
- [x] Run `npm test` — Ensure all 77 automated tests pass (0 failures).
- [x] Run `npx tsc --noEmit` — Ensure TypeScript type checking passes without errors.
- [x] Run `npm run build` — Ensure Vite bundles the full application with Workbox PWA precaching without errors.
- [x] Run `npm run build:rent` — Ensure standalone Rent Tracker builds cleanly.

### Step 2: Database & Backup
- [x] Verify `sync_queue` is excluded from database export JSON.
- [ ] Open Tahir Tracker -> **Settings** -> Click **Export Complete Backup (JSON)** to download a point-in-time snapshot.
- [ ] Perform live database migration strictly following [docs/AUTH_RLS_MIGRATION.md](file:///e:/Working%20Apps/Tahir%20Tracker/docs/AUTH_RLS_MIGRATION.md):
  - [ ] 1. Create Tahir Supabase Auth user.
  - [ ] 2. Retrieve user UUID.
  - [ ] 3. Pre-inspect row counts.
  - [ ] 4. Assign existing unowned rows to Tahir's UUID (`WHERE user_id IS NULL`).
  - [ ] 5. Apply restrictive RLS policies (`auth.uid() = user_id`).
  - [ ] 6. Verify anonymous access is denied via curl.

### Step 3: PWA / Web Deployment (Cloudflare Pages)
- [ ] Verify environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Cloudflare Pages dashboard.
- [ ] Deploy the `dist` folder:
  ```bash
  npx wrangler pages deploy dist --project-name tahir-tracker
  ```
- [ ] In browser, verify service worker registration in DevTools (`Application` -> `Service Workers`).
- [ ] Log in with Tahir's credentials and verify status transitions to `Live Sync`.

### Step 4: Android APK Deployment
- [x] Sync web assets to Capacitor Android project:
  ```bash
  npx cap sync android
  ```
- [x] Build Android debug APK:
  ```bash
  cd android
  .\gradlew.bat assembleDebug
  ```
- [x] Verify APK on disk: `android/app/build/outputs/apk/debug/app-debug.apk` (4.22 MB, `com.tahir.tracker`).
- [ ] Transfer `Tahir_Tracker.apk` to phone and install.
- [ ] Test offline transaction creation and cloud sync upon reconnecting to internet.
