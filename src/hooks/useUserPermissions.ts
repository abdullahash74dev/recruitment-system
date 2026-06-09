import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ===== Permission keys, grouped =====
export const PERMISSION_GROUPS = [
  {
    key: "tabs",
    ar: "التبويبات (الظهور في الداش بورد)",
    en: "Tabs (visibility in dashboard)",
    items: [
      "tab.applicants", "tab.jobs", "tab.projects", "tab.analytics", "tab.recruitment",
      "tab.settings", "tab.jobpage", "tab.backup", "tab.auditlog", "tab.rejection_reasons",
      "tab.job_ads", "tab.trash", "tab.ai_doctor", "tab.ai_usage", "tab.users",
    ],
  },
  {
    key: "applicants",
    ar: "المتقدمين",
    en: "Applicants",
    items: ["view_applicants", "edit_applicants", "applicants.delete", "applicants.export", "applicants.import", "applicants.send_email"],
  },
  {
    key: "jobs",
    ar: "الوظائف والإعلانات",
    en: "Jobs & Ads",
    items: ["view_jobs", "edit_jobs", "jobs.delete", "jobs.publish_ad"],
  },
  {
    key: "projects",
    ar: "المشاريع",
    en: "Projects",
    items: ["view_projects", "edit_projects", "manage_projects"],
  },
  {
    key: "analytics",
    ar: "التحليلات والتقارير",
    en: "Analytics & Reports",
    items: ["view_analytics", "analytics.export", "reports.run", "reports.schedule"],
  },
  {
    key: "system",
    ar: "النظام",
    en: "System",
    items: ["manage_settings", "manage_users", "manage_backup", "view_audit_log", "manage_synonyms"],
  },
] as const;

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items) as readonly string[];
export type PermissionKey = string;

export const PERMISSION_LABELS: Record<string, { ar: string; en: string }> = {
  // tabs
  "tab.applicants": { ar: "تبويب المتقدمين", en: "Applicants tab" },
  "tab.jobs": { ar: "تبويب الوظائف", en: "Jobs tab" },
  "tab.projects": { ar: "تبويب المشاريع", en: "Projects tab" },
  "tab.analytics": { ar: "تبويب التحليلات", en: "Analytics tab" },
  "tab.recruitment": { ar: "تبويب إدارة التوظيف", en: "Recruitment tab" },
  "tab.settings": { ar: "تبويب الإعدادات", en: "Settings tab" },
  "tab.jobpage": { ar: "تبويب صفحة الوظائف", en: "Job Page tab" },
  "tab.backup": { ar: "تبويب النسخ الاحتياطي", en: "Backup tab" },
  "tab.auditlog": { ar: "تبويب سجل النظام", en: "System Log tab" },
  "tab.rejection_reasons": { ar: "تبويب أسباب الرفض", en: "Rejection Reasons tab" },
  "tab.job_ads": { ar: "تبويب إعلانات الوظائف", en: "Job Ads tab" },
  "tab.trash": { ar: "تبويب سلة المحذوفات", en: "Trash tab" },
  "tab.ai_doctor": { ar: "تبويب طبيب النظام", en: "AI Doctor tab" },
  "tab.ai_usage": { ar: "تبويب استهلاك الذكاء", en: "AI Usage tab" },
  "tab.users": { ar: "تبويب إدارة المستخدمين", en: "Users tab" },
  // applicants
  view_applicants: { ar: "عرض المتقدمين", en: "View applicants" },
  edit_applicants: { ar: "تعديل المتقدمين", en: "Edit applicants" },
  "applicants.delete": { ar: "حذف المتقدمين", en: "Delete applicants" },
  "applicants.export": { ar: "تصدير المتقدمين", en: "Export applicants" },
  "applicants.import": { ar: "استيراد المتقدمين", en: "Import applicants" },
  "applicants.send_email": { ar: "إرسال إيميل للمتقدمين", en: "Send applicant emails" },
  // jobs
  view_jobs: { ar: "عرض الوظائف", en: "View jobs" },
  edit_jobs: { ar: "تعديل الوظائف", en: "Edit jobs" },
  "jobs.delete": { ar: "حذف الوظائف", en: "Delete jobs" },
  "jobs.publish_ad": { ar: "نشر الإعلانات", en: "Publish ads" },
  // projects
  view_projects: { ar: "عرض المشاريع", en: "View projects" },
  edit_projects: { ar: "تعديل المشاريع", en: "Edit projects" },
  manage_projects: { ar: "إدارة المشاريع (إضافة/تعديل/حذف)", en: "Manage projects (CRUD)" },
  // analytics
  view_analytics: { ar: "عرض الإحصائيات", en: "View analytics" },
  "analytics.export": { ar: "تصدير التحليلات", en: "Export analytics" },
  "reports.run": { ar: "تشغيل التقارير", en: "Run reports" },
  "reports.schedule": { ar: "جدولة التقارير", en: "Schedule reports" },
  // system
  manage_settings: { ar: "إدارة الإعدادات", en: "Manage settings" },
  manage_users: { ar: "إدارة المستخدمين", en: "Manage users" },
  manage_backup: { ar: "إدارة النسخ الاحتياطي", en: "Manage backup" },
  view_audit_log: { ar: "عرض سجل النظام", en: "View audit log" },
  manage_synonyms: { ar: "إدارة توحيد اللغة", en: "Manage synonyms" },
};

// Default permissions per role
const HR_BASE = [
  "tab.applicants","tab.jobs","tab.projects","tab.analytics","tab.recruitment","tab.rejection_reasons",
  "view_applicants","edit_applicants","applicants.export","applicants.import","applicants.send_email",
  "view_jobs","edit_jobs","jobs.publish_ad",
  "view_projects","view_analytics","analytics.export",
];
const ROLE_DEFAULTS: Record<string, PermissionKey[]> = {
  admin: [...ALL_PERMISSIONS],
  hr_manager: HR_BASE,
  recruitment_coordinator: HR_BASE,
  project_manager: ["tab.applicants","tab.jobs","tab.projects","tab.analytics","view_applicants","view_jobs","view_projects","view_analytics"],
};

export const getDefaultPermissions = (role: string): PermissionKey[] => ROLE_DEFAULTS[role] || [];

export const useUserPermissions = () => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => { loadPermissions(); }, []);

  const loadPermissions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const userRole = roleData?.role || "";
    setRole(userRole);
    const defaults = getDefaultPermissions(userRole);

    const { data: customPerms } = await supabase.from("user_permissions").select("permission_key, granted").eq("user_id", user.id);
    const overrides: Record<string, boolean> = {};
    customPerms?.forEach((p: any) => { overrides[p.permission_key] = p.granted; });

    const result: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach(key => {
      result[key] = key in overrides ? overrides[key] : defaults.includes(key);
    });

    setPermissions(result);
    setLoading(false);
  };

  const hasPermission = (key: PermissionKey): boolean => {
    if (role === "admin") return true;
    return permissions[key] ?? false;
  };

  return { permissions, loading, role, hasPermission, reload: loadPermissions };
};
