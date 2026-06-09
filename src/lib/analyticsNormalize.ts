// Bilingual normalization utilities for analytics
// Maps Arabic/English variations of cities, nationalities, education, etc. to a canonical key
// then renders a localized label based on UI language.

type Lang = "ar" | "en";

const norm = (s: string | null | undefined) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    // strip Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u0652\u0670]/g, "")
    // unify alef variants
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    // remove apostrophes / quotes
    .replace(/['’`"]/g, "")
    // collapse separators
    .replace(/[\s\-_،,.()\/]+/g, " ")
    .trim();

// Canonical entries: { key, ar, en, aliases[] (lowercased) }
interface Entry { key: string; ar: string; en: string; aliases: string[] }

const CITIES: Entry[] = [
  { key: "riyadh", ar: "الرياض", en: "Riyadh", aliases: ["riyadh", "riyad", "الرياض", "رياض"] },
  { key: "jeddah", ar: "جدة", en: "Jeddah", aliases: ["jeddah", "jedda", "jiddah", "جدة", "جده"] },
  { key: "makkah", ar: "مكة المكرمة", en: "Makkah", aliases: ["makkah", "mecca", "مكة", "مكه", "مكة المكرمة"] },
  { key: "madinah", ar: "المدينة المنورة", en: "Madinah", aliases: ["madinah", "medina", "المدينة", "المدينه", "المدينة المنورة"] },
  { key: "dammam", ar: "الدمام", en: "Dammam", aliases: ["dammam", "الدمام"] },
  { key: "khobar", ar: "الخبر", en: "Khobar", aliases: ["khobar", "al khobar", "الخبر"] },
  { key: "dhahran", ar: "الظهران", en: "Dhahran", aliases: ["dhahran", "الظهران"] },
  { key: "taif", ar: "الطائف", en: "Taif", aliases: ["taif", "al taif", "الطائف"] },
  { key: "abha", ar: "أبها", en: "Abha", aliases: ["abha", "أبها", "ابها"] },
  { key: "tabuk", ar: "تبوك", en: "Tabuk", aliases: ["tabuk", "تبوك"] },
  { key: "buraidah", ar: "بريدة", en: "Buraidah", aliases: ["buraidah", "buraydah", "بريدة"] },
  { key: "hail", ar: "حائل", en: "Hail", aliases: ["hail", "حائل"] },
  { key: "jazan", ar: "جازان", en: "Jazan", aliases: ["jazan", "jizan", "جازان", "جيزان"] },
  { key: "najran", ar: "نجران", en: "Najran", aliases: ["najran", "نجران"] },
  { key: "yanbu", ar: "ينبع", en: "Yanbu", aliases: ["yanbu", "ينبع"] },
  { key: "jubail", ar: "الجبيل", en: "Jubail", aliases: ["jubail", "الجبيل"] },
  { key: "qassim", ar: "القصيم", en: "Qassim", aliases: ["qassim", "القصيم"] },
];

const NATIONALITIES: Entry[] = [
  { key: "saudi", ar: "سعودي", en: "Saudi", aliases: ["saudi", "saudia", "saudi arabia", "ksa", "kingdom of saudi arabia", "سعودي", "سعودية", "سعوديه", "سعودي/ة", "سعودي ه", "المملكة العربية السعودية", "المملكه العربيه السعوديه", "السعودية", "السعوديه"] },
  { key: "egyptian", ar: "مصري", en: "Egyptian", aliases: ["egyptian", "egypt", "مصر", "مصري", "مصرية", "مصريه"] },
  { key: "yemeni", ar: "يمني", en: "Yemeni", aliases: ["yemeni", "yemen", "اليمن", "يمني", "يمنية", "يمنيه"] },
  { key: "syrian", ar: "سوري", en: "Syrian", aliases: ["syrian", "syria", "سوريا", "سوري", "سورية", "سوريه"] },
  { key: "jordanian", ar: "أردني", en: "Jordanian", aliases: ["jordanian", "jordan", "الأردن", "الاردن", "أردني", "اردني", "اردنيه"] },
  { key: "palestinian", ar: "فلسطيني", en: "Palestinian", aliases: ["palestinian", "palestine", "فلسطين", "فلسطيني", "فلسطينيه"] },
  { key: "sudanese", ar: "سوداني", en: "Sudanese", aliases: ["sudanese", "sudan", "السودان", "سوداني", "سودانيه"] },
  { key: "pakistani", ar: "باكستاني", en: "Pakistani", aliases: ["pakistani", "pakistan", "باكستان", "باكستاني", "باكستانيه"] },
  { key: "indian", ar: "هندي", en: "Indian", aliases: ["indian", "india", "الهند", "هندي", "هنديه"] },
  { key: "bangladeshi", ar: "بنغلاديشي", en: "Bangladeshi", aliases: ["bangladeshi", "bangladesh", "بنغلاديش", "بنغلاديشي"] },
  { key: "filipino", ar: "فلبيني", en: "Filipino", aliases: ["filipino", "philippines", "philippine", "الفلبين", "فلبيني", "فلبينيه"] },
  { key: "afghan", ar: "أفغاني", en: "Afghan", aliases: ["afghan", "afghani", "afghanistan", "أفغانستان", "افغانستان", "أفغاني", "افغاني"] },
  { key: "ethiopian", ar: "إثيوبي", en: "Ethiopian", aliases: ["ethiopian", "ethiopia", "إثيوبيا", "اثيوبيا", "إثيوبي", "اثيوبي"] },
  { key: "kenyan", ar: "كيني", en: "Kenyan", aliases: ["kenyan", "kenya", "كينيا", "كيني"] },
  { key: "nepali", ar: "نيبالي", en: "Nepali", aliases: ["nepali", "nepalese", "nepal", "نيبال", "نيبالي"] },
  { key: "srilankan", ar: "سريلانكي", en: "Sri Lankan", aliases: ["sri lankan", "srilankan", "sri lanka", "سريلانكا", "سريلانكي"] },
  { key: "lebanese", ar: "لبناني", en: "Lebanese", aliases: ["lebanese", "lebanon", "لبنان", "لبناني", "لبنانيه"] },
  { key: "iraqi", ar: "عراقي", en: "Iraqi", aliases: ["iraqi", "iraq", "العراق", "عراقي", "عراقيه"] },
  { key: "moroccan", ar: "مغربي", en: "Moroccan", aliases: ["moroccan", "morocco", "المغرب", "مغربي", "مغربيه"] },
  { key: "tunisian", ar: "تونسي", en: "Tunisian", aliases: ["tunisian", "tunisia", "تونس", "تونسي", "تونسيه"] },
];

const EDUCATION: Entry[] = [
  { key: "phd", ar: "دكتوراه", en: "PhD", aliases: ["phd", "doctorate", "دكتوراه"] },
  { key: "masters", ar: "ماجستير", en: "Master's", aliases: ["masters", "master", "ماجستير"] },
  { key: "bachelor", ar: "بكالوريوس", en: "Bachelor's", aliases: ["bachelor", "bachelors", "bsc", "ba", "بكالوريوس"] },
  { key: "diploma", ar: "دبلوم", en: "Diploma", aliases: ["diploma", "دبلوم"] },
  { key: "highschool", ar: "ثانوي", en: "High School", aliases: ["highschool", "high school", "secondary", "ثانوي", "ثانوية"] },
  { key: "intermediate", ar: "متوسط", en: "Intermediate", aliases: ["intermediate", "متوسط"] },
];

const GENDERS: Entry[] = [
  { key: "male", ar: "ذكر", en: "Male", aliases: ["male", "m", "ذكر"] },
  { key: "female", ar: "أنثى", en: "Female", aliases: ["female", "f", "أنثى", "انثى"] },
];

function buildLookup(entries: Entry[]) {
  const map = new Map<string, Entry>();
  entries.forEach(e => e.aliases.forEach(a => map.set(norm(a), e)));
  return map;
}

const CITY_LOOKUP = buildLookup(CITIES);
const NAT_LOOKUP = buildLookup(NATIONALITIES);
const EDU_LOOKUP = buildLookup(EDUCATION);
const GEN_LOOKUP = buildLookup(GENDERS);

import { lookupSynonym } from "@/hooks/useValueSynonyms";

export function normalizeCity(value: string | null | undefined, lang: Lang): string {
  if (!value) return lang === "ar" ? "غير محدد" : "Unknown";
  const db = lookupSynonym("city", value, lang);
  if (db) return db;
  const e = CITY_LOOKUP.get(norm(value));
  if (e) return lang === "ar" ? e.ar : e.en;
  return value.trim();
}
export function normalizeNationality(value: string | null | undefined, lang: Lang): string {
  if (!value) return lang === "ar" ? "غير محدد" : "Unknown";
  const db = lookupSynonym("nationality", value, lang);
  if (db) return db;
  const e = NAT_LOOKUP.get(norm(value));
  if (e) return lang === "ar" ? e.ar : e.en;
  return value.trim();
}
export function normalizeEducation(value: string | null | undefined, lang: Lang): string {
  if (!value) return lang === "ar" ? "غير محدد" : "Unknown";
  const db = lookupSynonym("education_level", value, lang);
  if (db) return db;
  const n = norm(value);
  const e = EDU_LOOKUP.get(n);
  if (e) return lang === "ar" ? e.ar : e.en;
  // Contains-match: group variants like "بكالوريوس هندسة", "بكالوريوس حاسب", "Bachelor of Science"
  const order = ["phd", "masters", "bachelor", "diploma", "highschool", "intermediate"];
  for (const key of order) {
    const entry = EDUCATION.find(x => x.key === key);
    if (!entry) continue;
    for (const alias of entry.aliases) {
      const a = norm(alias);
      if (a && n.includes(a)) return lang === "ar" ? entry.ar : entry.en;
    }
  }
  return value.trim();
}
export function normalizeGender(value: string | null | undefined, lang: Lang): string {
  if (!value) return lang === "ar" ? "غير محدد" : "Unknown";
  const e = GEN_LOOKUP.get(norm(value));
  if (e) return lang === "ar" ? e.ar : e.en;
  return value.trim();
}


export function isSaudi(value: string | null | undefined): boolean {
  if (!value) return false;
  return NAT_LOOKUP.get(norm(value))?.key === "saudi";
}

// Parses salary strings that may be ranges like:
//  - "4,000 إلى 4,999 ريال"  -> midpoint 4499
//  - "1,000 to 1,999 SAR"    -> midpoint 1499
//  - "أعلى من 50,000 ريال"   -> 50000
//  - "أقل من 1,000"          -> 1000
//  - "5000"                   -> 5000
export function parseSalary(s: string | null | undefined): number {
  if (!s) return 0;
  const str = String(s).trim();
  if (!str) return 0;
  // Extract all numeric tokens (allowing thousands separators , or .)
  const matches = str.match(/\d[\d,\.]*/g);
  if (!matches || matches.length === 0) return 0;
  const nums = matches
    .map(m => parseInt(m.replace(/[^\d]/g, ""), 10))
    .filter(n => !isNaN(n) && n > 0);
  if (nums.length === 0) return 0;
  if (nums.length === 1) return nums[0];
  // Range: take midpoint of first two numbers
  return Math.round((nums[0] + nums[1]) / 2);
}

// Aggregate helpers
export function sumSalaries(values: (string | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + parseSalary(v), 0);
}
export function avgSalaries(values: (string | null | undefined)[]): number {
  const nums = values.map(v => parseSalary(v)).filter(n => n > 0);
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// Generic grouping helper that uses a normalizer
export function groupByNormalized<T>(
  items: T[],
  getValue: (item: T) => string | null | undefined,
  normalizer: (v: string | null | undefined, lang: Lang) => string,
  lang: Lang,
  limit?: number
) {
  const map: Record<string, number> = {};
  items.forEach(it => {
    const k = normalizer(getValue(it), lang);
    map[k] = (map[k] || 0) + 1;
  });
  const arr = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  return limit ? arr.slice(0, limit) : arr;
}
