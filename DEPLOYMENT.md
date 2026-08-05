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

4. In Supabase Auth settings, add your Vercel domain to the allowed redirect
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

## 4. Data protection notes

- All HR tables enforce RLS: only the `admin` role can manage templates,
  employees, approvals and issuances; other users see only what they were
  explicitly granted (per-template fill grants) or their own requests.
- Issued documents are archived in the private `hr-form-documents` bucket
  and downloadable only via 10-minute signed URLs.
- Every insert/update/delete on HR tables is captured in `audit_log`
  automatically (with deleted rows snapshotted to the recoverable Trash),
  and every export/import is logged as an app-level audit event.
