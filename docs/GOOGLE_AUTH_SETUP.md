# Google Authentication Setup Guide for Tahir Tracker Multi-User SaaS

This guide provides step-by-step instructions for configuring Google Sign-In with Supabase Auth for Tahir Tracker.

---

## 1. Prerequisites
- Access to [Google Cloud Console](https://console.cloud.google.com/)
- Access to your [Supabase Dashboard](https://supabase.com/dashboard/project/weomrqzammqldszitgcf)

---

## 2. Google Cloud Console Setup

### Step 2.1: Create or Select a Project
1. Log in to the [Google Cloud Console](https://console.cloud.google.com/).
2. In the project selector dropdown (top left), click **New Project** (or select an existing project).
3. Name your project (e.g. `Tahir Tracker SaaS`) and click **Create**.

### Step 2.2: Configure OAuth Consent Screen
1. In the left navigation, go to **APIs & Services** > **OAuth consent screen**.
2. Select User Type: **External** and click **Create**.
3. Fill in the App Information:
   - **App name**: `Tahir Tracker`
   - **User support email**: Your admin/support email
   - **Developer contact information**: Your email
4. Click **Save and Continue**.
5. **Scopes**: You do NOT need sensitive scopes. By default, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid` are selected. Click **Save and Continue**.
6. **Test Users** (if in Testing mode): Add your Google email address so you can sign in during testing.
7. Click **Save and Continue**, then return to the Dashboard.

### Step 2.3: Create OAuth 2.0 Client Credentials
1. In the left navigation, go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Set **Application type** to: `Web application`.
4. Set **Name** to: `Tahir Tracker Web Client`.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (Local development)
   - `http://localhost:4173` (Local preview)
   - `https://weomrqzammqldszitgcf.supabase.co` (Supabase project)
   - Your production domain (e.g., `https://tahirtracker.app` or `https://your-domain.vercel.app`)
6. Under **Authorized redirect URIs**, add your Supabase Auth callback URI:
   - `https://weomrqzammqldszitgcf.supabase.co/auth/v1/callback`
7. Click **Create**.
8. A modal will appear displaying your **Client ID** and **Client Secret**. Keep this window open or copy both values securely.
   > **SECURITY WARNING**: Never commit your Google Client Secret or paste it into frontend code!

---

## 3. Supabase Dashboard Setup

### Step 3.1: Enable the Google Auth Provider
1. Open your Supabase Project: [weomrqzammqldszitgcf](https://supabase.com/dashboard/project/weomrqzammqldszitgcf).
2. In the left sidebar, navigate to **Authentication** > **Providers**.
3. Find **Google** in the provider list and click to expand it.
4. Toggle **Enable Google provider** to **ON**.
5. Paste your **Client ID** from Google Cloud into the `Client ID` field.
6. Paste your **Client Secret** from Google Cloud into the `Client Secret` field.
7. Click **Save**.

### Step 3.2: Configure URL Settings & Redirects
1. In the Supabase left sidebar, navigate to **Authentication** > **URL Configuration**.
2. Set **Site URL**:
   - For production: `https://your-production-domain.com`
   - For local development: `http://localhost:5173`
3. Under **Redirect URLs**, add wildcard patterns for your domains:
   - `http://localhost:5173/**`
   - `http://localhost:4173/**`
   - `https://your-production-domain.com/**`
4. Click **Save**.

---

## 4. Verifying Multi-User Isolation

Once Google Sign-In is enabled in the Supabase Dashboard:

1. **Sign In**: Launch Tahir Tracker (`npm run dev`) and click **"Continue with Google"**.
2. **Onboarding**: Upon signing in with a new Google account, the 3-step **Workspace Setup** wizard will open, allowing you to select your primary currency and enabled tracking modules.
3. **Workspace Isolation**:
   - The user's offline IndexedDB database will be named `TahirTrackerDB_<userId>`.
   - All cloud sync operations send and receive rows strictly filtered by `user_id = auth.uid()`.
   - Other users' data (including Tahir's private records) is strictly invisible and unreachable.
4. **Sign Out**: Clicking your avatar or visiting Settings -> Sign Out closes the active database and sync channels, clearing the local session.
