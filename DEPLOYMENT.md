# Deployment Guide — AlKholi Group System

This app (recruitment + HR Forms management) deploys as a static Vite build on
**Vercel**, with **Supabase** providing the database, auth, storage and edge
functions. Sensitive HR data never lives in Vercel — it stays in Supabase
behind Row Level Security, and the private `hr-form-documents` bucket is only
reachable through short-lived signed URLs.

## 1. Supabase (data layer)

1. Create a project at [supabase.com](https://supabase.com) (the Pro plan is
   recommended for daily backups and no project pausing — suitable for
   sensitive HR data; the Free plan works for evaluation).
2. Link the repo's migrations and push them (this creates every table, all
   RLS policies, the storage buckets, and seeds all 31 HR form templates):

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. Deploy the edge functions (at minimum `verify-delete-pin`, which powers
   the security PIN used for deletes and HR form issuance):

   ```bash
   npx supabase functions deploy
   ```

4. **Edge function secrets (required for AI features and system health to
   work)** — `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase into
   every edge function; nothing to do for those. Everything below needs to
   be set explicitly, or the corresponding feature fails silently (AI calls
   return "No AI key configured", System Health checks report unavailable,
   emails never actually send):

   ```bash
   npx supabase secrets set \
     ANTHROPIC_API_KEY=sk-ant-... \
     GEMINI_API_KEY=AIza... \
     SUPABASE_MGMT_TOKEN=sbp_... \
     RESEND_API_KEY=re_... \
     RESEND_FROM_EMAIL="Your Company <no-reply@yourdomain.com>"
   ```

   | Secret | Powers | Get it from |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | AI resume analysis, AI job-match, AI resume summaries, smart AI search filters (one of Anthropic/Gemini is required — the admin's AI Settings picks the active provider and falls back to whichever key is present) | [console.anthropic.com](https://console.anthropic.com) |
   | `GEMINI_API_KEY` | Résumé data extraction, applicant/job-title analysis, import assistant, logo background removal, and the same AI features as above when Gemini is the selected provider | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
   | `SUPABASE_MGMT_TOKEN` | Dashboard → System Health's live project-health checks (optional — only that one panel degrades without it) | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) (personal access token) |
   | `RESEND_API_KEY` | Actually sending application-confirmation emails and HR-to-candidate status emails (without it, sends fail with "RESEND_API_KEY is not configured" and the failure is logged, not silently dropped) | [resend.com](https://resend.com) — add and verify your sending domain first, then create an API key |
   | `RESEND_FROM_EMAIL` | Optional but recommended: the "from" address emails are sent as, e.g. `"AlKholi Group <no-reply@alkholigroup.com>"`. Without it, emails send from Resend's own shared test address (works immediately, no domain needed, but is rate-limited and shows "via resend.dev" to recipients) | must be on a domain you verified in Resend |
   | `ALLOWED_ORIGIN` | Optional, recommended once you know your final domain: restricts every edge function's CORS response to this one origin instead of `*` (e.g. `https://your-app.vercel.app`). Not required to launch — every sensitive function already checks the caller's Bearer token regardless, and this is only an extra layer on top | your production URL |

5. In Supabase Auth settings, add your Vercel domain to the allowed redirect
   URLs.

## 2. Vercel (hosting)

1. Import the GitHub repository at [vercel.com/new](https://vercel.com/new).
2. **Project name**: `alkholi-group-system` (this controls the default
   `alkholi-group-system.vercel.app` domain; attach a custom domain later
   from Project → Settings → Domains).
3. Framework preset: **Vite** (auto-detected; `vercel.json` in the repo
   already sets the SPA rewrite and security headers, including CSP and HSTS).
4. Environment variables (Project → Settings → Environment Variables):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_PROJECT_ID` | `<project-ref>` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the project's anon/publishable key |

5. Deploy. Every push to the production branch redeploys automatically.

## 3. First-run configuration (inside the app)

1. Create the first admin user (Supabase Auth → Users → Add user), then give
   it the admin role:

   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('<auth-user-uuid>', 'admin');
   ```

2. Sign in at `/admin/login`.
3. **Branding**: Dashboard → Settings → Branding — set the company name
   (e.g. "AlKholi Group System" / "مجموعة الخولي") and upload the company
   logo. The HR Forms module renders this branding on every generated
   document; nothing is hardcoded.
4. **Security PIN**: Dashboard → Settings — set the security PIN. The same
   PIN protects destructive deletes and the final "Issue & Archive" step for
   HR forms.
5. **HR Forms**: open **HR Forms** from the dashboard sidebar — the 31
   seeded templates are already published and ready; add employees (manually
   or via Bulk Excel → Employee Master Import) and start issuing forms.

## 4. Before you announce the site publicly

`index.html`'s `<title>`/description/`og:*` tags are set to "Sadaawah Talent
AI" / "صداوة للمواهب". If that ever changes, update them (and the
`site_name_ar`/`site_name_en` row in `site_settings` -- see the note below)
together, since search engines and link-preview crawlers (WhatsApp, Twitter,
LinkedIn...) only ever see this static file, not the name configured live in
the dashboard. While you're in there:

- Replace `<title>`, `og:title`, `twitter:title`, and both description tags
  with your real name/description.
- Add `og:image` / `twitter:image` pointing to a real 1200×630 brand image
  (a plain screenshot of the homepage works fine to start).
- Add `og:url` with your final domain.
- Add a `public/sitemap.xml` listing your public routes (`/`, `/apply`,
  `/jobs`, `/training`, `/track`) with `<loc>` set to your final domain, and
  a `Sitemap: https://your-domain/sitemap.xml` line in `public/robots.txt`.

**`site_settings` must always hold exactly one row.** Branding, colors, the
live site name shown everywhere (`site_name_ar`/`site_name_en`), and more all
come from this single row. Every read uses `.single()`, which fails (falling
back to hardcoded defaults, e.g. "Sadaawah Talent AI") the moment there are
zero rows *or more than one* -- and Branding Settings' Save button then
fails outright with `invalid input syntax for type uuid: ''`, since the
fallback object has no real `id` to update. If that ever happens again,
check `SELECT id, site_name_ar, created_at FROM public.site_settings;` in the
SQL Editor, keep the one row with your real settings, and delete the rest.

## 5. Data protection notes

- All HR tables enforce RLS: only the `admin` role can manage templates,
  employees, approvals and issuances; other users see only what they were
  explicitly granted (per-template fill grants) or their own requests.
- Issued documents are archived in the private `hr-form-documents` bucket
  and downloadable only via 10-minute signed URLs.
- Every insert/update/delete on HR tables is captured in `audit_log`
  automatically (with deleted rows snapshotted to the recoverable Trash),
  and every export/import is logged as an app-level audit event.
