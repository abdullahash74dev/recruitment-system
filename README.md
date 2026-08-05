# AlKholi Group System

Recruitment platform + **HR Forms Management** module (React + Vite +
TypeScript + shadcn/ui + Supabase, deployed on Vercel).

## HR Forms module (`/admin/hr-forms`)

- **Employee master data** — one shared source that auto-fills every form.
- **31 seeded, ISO-style document-controlled templates** (leave, contracts,
  certificates, payroll, clearance, training, recruitment...) rebuilt
  bilingual (EN primary / AR) with configurable company branding.
- **Template Builder** — admins create/edit any form: sections, 11 field
  types, employee-field auto-fill mapping, safe computed formulas (incl. EOS
  gratuity per Saudi Labor Law).
- **Workflow** — draft → submit → approve/reject → PIN-protected issue, with
  all four formats (PDF / Excel / Word / PNG) archived to private storage
  and an append-only usage ledger.
- **Excel bulk tools** — employee import, bulk-fill one form for many
  employees, and cross-form aggregate data collection sheets.
- **Access control** — full RLS; per-template fill-only grants for
  non-HR users; complete audit logging.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel + Supabase setup.

## Development

```bash
npm install
npm run dev      # local dev server
npm run test     # vitest
npm run build    # production build
```
