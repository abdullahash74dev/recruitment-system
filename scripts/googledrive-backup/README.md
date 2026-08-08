# نسخ احتياطي للسير الذاتية إلى Google Drive

نسخة موازية لأداة `scripts/onedrive-backup` — نفس الفكرة بالضبط، لكن ترفع لحساب **Google Drive** الشخصي بدل OneDrive. تقدر تشغّل الأداتين معاً (نسخة على OneDrive ونسخة ثانية مستقلة على Google Drive) بدون أي تعارض بينهما — كل وحدة تسجّل تقدمها في نفس جدول `external_backups` لكن بعمود `destination` مختلف (`onedrive` أو `googledrive`).

**Supabase يبقى المصدر الحي الذي يشغّل الموقع** — هذه نسخة احتياطية إضافية فقط.

## 1) إعداد مشروع في Google Cloud (مرة واحدة فقط)

1. افتح https://console.cloud.google.com وسجّل دخولك بحساب Google اللي تبي ترفع له الملفات.
2. أنشئ مشروع جديد (أو استخدم مشروع موجود) من القائمة أعلى الصفحة.
3. من القائمة الجانبية: **APIs & Services** → **Library** → ابحث عن **Google Drive API** → **Enable**.
4. اذهب إلى **APIs & Services** → **OAuth consent screen**:
   - **User Type**: اختر **External** ثم **Create**.
   - عبّي الحقول المطلوبة فقط (اسم التطبيق، بريدك كـ Support email وContact).
   - في خطوة **Scopes** لا تحتاج تضيف شيء يدوياً (الأداة تطلبها تلقائياً عند تسجيل الدخول).
   - كمّل الخطوات وارجع لصفحة OAuth consent screen، واضغط **PUBLISH APP** (تحويل الحالة من Testing إلى In production) — **مهم جداً**، لأن في وضع Testing تنتهي صلاحية الجلسة كل ٧ أيام وتحتاج تسجل دخول من جديد باستمرار.
5. اذهب إلى **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - **Application type**: اختر **TVs and Limited Input devices**.
   - أعطه اسم واضغط **Create**.
   - انسخ **Client ID** و **Client Secret** — هذولي بتحطهم بـ `.env`.

عند تسجيل الدخول لاحقاً بالخطوة 3 أدناه، Google رح يعرض تحذير "Google hasn't verified this app" — هذا متوقع وطبيعي (لأنه تطبيقك الخاص بمشروعك الخاص ولم يمر بمراجعة Google الرسمية، وهو غير مطلوب لاستخدام شخصي). اضغط **Advanced** ثم **Go to (اسم التطبيق) (unsafe)** للمتابعة بأمان — أنت فقط من يملك هذا التطبيق وهو لا يصل إلا لملفات ينشئها هو نفسه.

## 2) الإعداد المحلي

```bash
cd scripts/googledrive-backup
npm install
cp .env.example .env
```

افتح `.env` وعبّي:
- `SUPABASE_URL` — موجود مسبقاً بالقيمة الصحيحة.
- `SUPABASE_SERVICE_ROLE_KEY` — من لوحة Supabase: **Project Settings → API → service_role key**. **لا تشارك هذا المفتاح مع أحد ولا ترفعه لأي مكان.**
- `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` — من الخطوة 1.

## 3) تسجيل الدخول لمرة واحدة

```bash
npm run auth
```

بتظهر لك رسالة فيها رمز قصير ورابط — افتح الرابط من أي جهاز، أدخل الرمز، سجّل دخولك بحساب Google Drive اللي تريده. بعدها الجلسة تُحفظ محلياً (`.token-cache.json`) وما تحتاج تكرر هالخطوة.

## 4) تشغيل النسخ الاحتياطي

```bash
npm run status          # يعرض عدد وأسماء الملفات اللي لسه ما انرفعت، بدون رفع فعلي
npm run backup           # يرفع كل الملفات الناقصة
node backup.mjs --limit=20     # تجربة أولى محدودة بعدد ملفات
node backup.mjs --export-data  # يرفع الملفات + نسخة JSON كاملة من جدول applicants
```

الملفات ترفع تحت مجلد `RecruitmentBackups/` (قابل للتغيير عبر `GDRIVE_ROOT_FOLDER`) في My Drive، بالشكل:

```
RecruitmentBackups/
  resume/<applicant-id>/<اسم الملف الأصلي>
  data-exports/applicants-2026-08-08.json   (فقط مع --export-data)
```

شغّل `npm run backup` بشكل دوري — كل تشغيلة ترفع فقط الجديد.

## ملاحظات أمان

- ملف `.env` و `.token-cache.json` مستثنيان من git تلقائياً (`.gitignore` بهذا المجلد) — لا ترفعهم لأي مستودع.
- `SUPABASE_SERVICE_ROLE_KEY` يتجاوز كل قيود الصلاحيات (RLS) ويقدر يقرأ كل بيانات المتقدمين — شغّل هذه الأداة فقط من جهاز تثق فيه.
- لمعرفة أي الملفات لسه ما انسخت من داخل لوحة الإدارة نفسها (بدون تشغيل الأداة)، شوف بطاقة "النسخ الاحتياطي الخارجي" في تبويب **النسخ الاحتياطي** — تعرض حالة OneDrive وGoogle Drive معاً.
