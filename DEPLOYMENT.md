# 🚀 Tahir Tracker — Cloudflare Pages & Supabase Deployment Guide

Yeh guide aapko step-by-step batayegi ke **Tahir Tracker** ko **GitHub**, **Cloudflare Pages**, aur **Supabase** ke sath kaise deploy aur live karna hai (bina kisi paid domain ya subscription ke).

---

## 📌 Requirements Summary
- **GitHub Repository**: `ManuscriptHeaven/Tahir-Tracker`
- **Frontend Hosting**: Cloudflare Pages (Free Plan)
- **Backend Database**: Supabase PostgreSQL (Free Tier)
- **Framework**: Vite + React + TypeScript + Tailwind CSS

---

## 🔹 STEP 1: Supabase Database Setup

1. **Supabase Dashboard** open karein: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Apna project select karein ya new project banayein.
3. Left menu me **SQL Editor** par click karein.
4. `supabase_schema.sql` file ka poora code copy karein aur SQL Editor me paste kar ke **Run** daba dein.
   - *Is se Utility, Milk, Petrol, Rent, Loans, aur Settings ki tamam tables aur Row Level Security (RLS) policies ban jayengi.*
5. **Project Settings** (gear icon) ➡️ **API** me jayein:
   - **Project URL** copy karein: `https://your-project-ref.supabase.co`
   - **anon / public key** copy karein: `sb_publishable_...` ya `eyJhbG...`

---

## 🔹 STEP 2: GitHub Repository Verification

Aapka code already GitHub par pushed hai:
- **Repo URL**: `https://github.com/ManuscriptHeaven/Tahir-Tracker.git`
- **Branch**: `main`

Agar future me koi changes karein, to terminal me simple ye commands run karein:
```bash
git add .
git commit -m "Update app"
git push origin main
```

---

## 🔹 STEP 3: Cloudflare Pages Deployment (Step-by-Step)

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) open karein.
2. Left sidebar me **Workers & Pages** par click karein.
3. **Create application** ➡️ **Pages** tab select karein.
4. **Connect to Git** par click karein aur apna GitHub account connect karein.
5. Repository select karein: **`ManuscriptHeaven/Tahir-Tracker`** (ya `Tahir-Tracker`).
6. **Set up builds and deployments** me yeh settings enter karein:
   - **Framework preset**: `Vite` (ya `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (khali chor dein)

7. **Environment variables (Advanced)** section expand karein aur 2 variables add karein:
   | Variable Name | Value |
   | :--- | :--- |
   | `VITE_SUPABASE_URL` | *Aapka Supabase Project URL* |
   | `VITE_SUPABASE_ANON_KEY` | *Aapka Supabase Anon Public Key* |

8. **Save and Deploy** par click karein.
9. 1 se 2 minute me aapki app live ho jayegi aur aapko free live link mil jayega:
   `https://tahir-tracker.pages.dev` (ya aapka custom pages.dev name).

---

## 🔹 STEP 4: Supabase Authentication / URL Configuration (Optional)

1. Supabase Dashboard me **Authentication** ➡️ **URL Configuration** me jayein.
2. **Site URL** me apna Cloudflare Pages URL enter karein (e.g. `https://tahir-tracker.pages.dev`).
3. **Redirect URLs** me add karein:
   - `https://tahir-tracker.pages.dev/**`
   - `http://localhost:5173/**`
4. **Save** par click karein.

---

## 🔹 STEP 5: Testing & Sync Verification

1. Apna live Cloudflare link open karein: `https://tahir-tracker.pages.dev`
2. App me **Settings** ⚙️ tab par jayein.
3. Supabase Cloud Sync card me **Test Connection** click karein ➡️ `Successfully connected to Supabase Database!` ka message aayega.
4. **Sync Now** click karein ➡️ Aapka tamam data cloud me synchronize ho jayega!
5. App offline b full speed se chalegi aur jaise hi internet connected hoga, background me auto-sync hoti rahegi.

---

### 🎉 Mubarak ho! Aapka Tahir Tracker GitHub, Cloudflare Pages aur Supabase par fully deployed hai.
