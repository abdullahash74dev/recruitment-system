# نسخ احتياطي للسير الذاتية إلى OneDrive

أداة مستقلة تعمل من جهازك (لا علاقة لها بموقع الويب أو Vercel أو Supabase Edge Functions) تحمّل كل سيرة ذاتية (وبقية المستندات إن رغبت) من Supabase Storage وترفعها إلى حساب OneDrive الشخصي الخاص بك، بحيث تصبح نسخة تملكها أنت فعلياً خارج نطاق أي مزوّد SaaS. **Supabase يبقى المصدر الحي الذي يشغّل الموقع** — هذه نسخة احتياطية موازية فقط، وليست بديلاً عن ملفات الموقع.

كل رفع ناجح يُسجَّل في جدول `external_backups` بقاعدة بيانات Supabase، فتقدر تشغّل الأداة أكثر من مرة بأمان: في كل مرة ترفع فقط الملفات التي لم تُنسخ بعد أو التي فشلت آخر مرة.

## 1) تسجيل تطبيق في Microsoft Entra (مرة واحدة فقط)

1. افتح https://portal.azure.com وسجّل دخولك (بنفس حساب Microsoft/OneDrive اللي تبي ترفع له، أو أي حساب له صلاحية تسجيل تطبيقات).
2. من البحث اذهب إلى **Microsoft Entra ID** → **App registrations** → **New registration**.
3. اسم أي شيء، مثلاً `Recruitment Résumé Backup`.
4. **Supported account types**: اختر **Personal Microsoft accounts only** (إذا حسابك شخصي عادي) أو **Accounts in any organizational directory and personal Microsoft accounts** إذا مو متأكد.
5. اترك **Redirect URI** فاضي (مو مطلوب لطريقة تسجيل الدخول اللي تستخدمها الأداة). اضغط **Register**.
6. من صفحة التطبيق، انسخ **Application (client) ID** — هذا اللي بتحطه في `.env`.
7. من القائمة الجانبية اذهب إلى **Authentication** → فعّل **Allow public client flows** = **Yes** → احفظ.
8. اذهب إلى **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → أضف: `Files.ReadWrite` و `offline_access` و `User.Read` → احفظ.
   (لا حاجة لـ "Grant admin consent" إذا الحساب شخصي — رح توافق أنت بنفسك عند تسجيل الدخول.)

## 2) الإعداد المحلي

```bash
cd scripts/onedrive-backup
npm install
cp .env.example .env
```

افتح `.env` وعبّي:
- `SUPABASE_URL` — موجود مسبقاً بالقيمة الصحيحة.
- `SUPABASE_SERVICE_ROLE_KEY` — من لوحة Supabase: **Project Settings → API → service_role key**. **لا تشارك هذا المفتاح مع أحد ولا ترفعه لأي مكان.**
- `ONEDRIVE_CLIENT_ID` — الـ Client ID اللي نسخته بالخطوة 1.
- `ONEDRIVE_TENANT` — اتركه `consumers` لحساب Microsoft شخصي.

## 3) تسجيل الدخول لمرة واحدة

```bash
npm run auth
```

بتظهر لك رسالة فيها رمز قصير ورابط (`https://microsoft.com/devicelogin`) — افتح الرابط من أي جهاز، أدخل الرمز، سجّل دخولك بحساب OneDrive اللي تريده. بعدها الجلسة تُحفظ محلياً (`.token-cache.json`) وما تحتاج تكرر هالخطوة (إلا إذا حذفت الملف أو انتهت صلاحية الجلسة من طرف Microsoft).

## 4) تشغيل النسخ الاحتياطي

```bash
npm run status          # يعرض عدد وأسماء الملفات اللي لسه ما انرفعت، بدون رفع فعلي
npm run backup           # يرفع كل الملفات الناقصة
node backup.mjs --limit=20     # تجربة أولى محدودة بعدد ملفات
node backup.mjs --export-data  # يرفع الملفات + نسخة JSON كاملة من جدول applicants
```

الملفات ترفع تحت مجلد `RecruitmentBackups/` (قابل للتغيير عبر `ONEDRIVE_ROOT_FOLDER`) في جذر OneDrive، بالشكل:

```
RecruitmentBackups/
  resume/<applicant-id>/<اسم الملف الأصلي>
  data-exports/applicants-2026-08-08.json   (فقط مع --export-data)
```

شغّل `npm run backup` بشكل دوري (يدوياً، أو عبر مجدول مهام على جهازك/سيرفرك الخاص) — كل تشغيلة ترفع فقط الجديد.

## ملاحظات أمان

- ملف `.env` و `.token-cache.json` مستثنيان من git تلقائياً (`.gitignore` بهذا المجلد) — لا ترفعهم لأي مستودع.
- `SUPABASE_SERVICE_ROLE_KEY` يتجاوز كل قيود الصلاحيات (RLS) ويقدر يقرأ كل بيانات المتقدمين — شغّل هذه الأداة فقط من جهاز تثق فيه.
- لمعرفة أي الملفات لسه ما انسخت من داخل لوحة الإدارة نفسها (بدون تشغيل الأداة)، شوف بطاقة "النسخ الاحتياطي الخارجي (OneDrive)" في تبويب **النسخ الاحتياطي**.
