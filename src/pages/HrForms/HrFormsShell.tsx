// HR Forms module shell: its own layout and nested routes, mounted at
// /admin/hr-forms/* behind AdminGuard. Kept out of DashboardPage on purpose —
// this module is a full sub-app, not another dashboard tab.

import { useMemo } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ClipboardCheck, FileSpreadsheet, FileText, History,
  LayoutTemplate, ListChecks, Moon, ShieldCheck, Sun, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useHrFormSubmissionsQuery } from "@/hooks/queries/useHrForms";
import CatalogPage from "./CatalogPage";
import EmployeesPage from "./EmployeesPage";
import FillFormPage from "./FillFormPage";
import TemplateBuilderListPage from "./TemplateBuilderListPage";
import TemplateBuilderEditorPage from "./TemplateBuilderEditorPage";
import MyRequestsPage from "./MyRequestsPage";
import ApprovalsInboxPage from "./ApprovalsInboxPage";
import TemplatePermissionsPage from "./TemplatePermissionsPage";
import UsageLogPage from "./UsageLogPage";
import BulkToolsPage from "./BulkToolsPage";

const HrFormsShell = () => {
  const { lang, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { role, hasPermission, loading } = useUserPermissions();
  const isAdmin = role === "admin";
  const { data: submissions = [] } = useHrFormSubmissionsQuery();
  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === "submitted").length,
    [submissions],
  );

  if (!loading && !isAdmin && !hasPermission("hr_forms.access")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={dir}>
        <div className="text-center space-y-3">
          <h1 className="text-xl font-bold">{lang === "ar" ? "لا تملك صلاحية الوصول" : "No access"}</h1>
          <p className="text-muted-foreground text-sm">
            {lang === "ar" ? "اطلب من مدير النظام منحك صلاحية نماذج الموارد البشرية." : "Ask an administrator to grant you HR Forms access."}
          </p>
          <Button variant="outline" onClick={() => navigate("/admin")}>{lang === "ar" ? "العودة" : "Back"}</Button>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: "/admin/hr-forms/catalog", icon: FileText, en: "Catalog", ar: "دليل النماذج", show: true, badge: 0 },
    { to: "/admin/hr-forms/requests", icon: ListChecks, en: "My Requests", ar: "طلباتي", show: true, badge: 0 },
    { to: "/admin/hr-forms/approvals", icon: ClipboardCheck, en: "Approvals", ar: "الاعتمادات", show: isAdmin, badge: pendingCount },
    { to: "/admin/hr-forms/employees", icon: Users, en: "Employees", ar: "الموظفون", show: isAdmin || hasPermission("hr_forms.view_employees"), badge: 0 },
    { to: "/admin/hr-forms/templates", icon: LayoutTemplate, en: "Builder", ar: "منشئ القوالب", show: isAdmin, badge: 0 },
    { to: "/admin/hr-forms/permissions", icon: ShieldCheck, en: "Access", ar: "الصلاحيات", show: isAdmin, badge: 0 },
    { to: "/admin/hr-forms/bulk", icon: FileSpreadsheet, en: "Bulk Excel", ar: "أدوات الإكسل", show: isAdmin, badge: 0 },
    { to: "/admin/hr-forms/log", icon: History, en: "Usage Log", ar: "سجل الإصدارات", show: isAdmin, badge: 0 },
  ];

  const badge = (count: number) =>
    count > 0 ? (
      <span className="min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
        {count}
      </span>
    ) : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir={dir}>
      <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-20">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} title={lang === "ar" ? "لوحة التحكم" : "Dashboard"}>
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Button>
        <h1 className="font-bold text-lg whitespace-nowrap">{lang === "ar" ? "نماذج الموارد البشرية" : "HR Forms"}</h1>
        <nav className="ms-4 hidden lg:flex items-center gap-1 overflow-x-auto">
          {navItems.filter((i) => i.show).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {lang === "ar" ? item.ar : item.en}
              {badge(item.badge)}
            </NavLink>
          ))}
        </nav>
        <div className="ms-auto">
          <Button variant="ghost" size="icon" onClick={toggleTheme} title={lang === "ar" ? "الوضع الليلي/النهاري" : "Toggle theme"}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Compact nav for small screens */}
      <nav className="lg:hidden flex border-b border-border overflow-x-auto">
        {navItems.filter((i) => i.show).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 min-w-[4.5rem] flex flex-col items-center gap-0.5 py-2 text-[11px] whitespace-nowrap ${
                isActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`
            }
          >
            <span className="relative">
              <item.icon className="h-4 w-4" />
              {item.badge > 0 && <span className="absolute -top-1 -end-1.5 w-2 h-2 rounded-full bg-amber-500" />}
            </span>
            {lang === "ar" ? item.ar : item.en}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        <Routes>
          <Route index element={<Navigate to="catalog" replace />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="requests" element={<MyRequestsPage />} />
          <Route path="approvals" element={<ApprovalsInboxPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="fill/:templateId" element={<FillFormPage />} />
          <Route path="templates" element={<TemplateBuilderListPage />} />
          <Route path="templates/:templateId" element={<TemplateBuilderEditorPage />} />
          <Route path="permissions" element={<TemplatePermissionsPage />} />
          <Route path="bulk" element={<BulkToolsPage />} />
          <Route path="log" element={<UsageLogPage />} />
          <Route path="*" element={<Navigate to="catalog" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-border px-6 py-3 text-center text-xs text-muted-foreground">
        {lang === "ar"
          ? "نظام نماذج الموارد البشرية — جميع الحقوق محفوظة © عبدالله الشواف، مساعد المدير العام للموارد البشرية"
          : "HR Forms System — All rights reserved © Abdullah Al-Shawaf, Assistant GM of Human Resources"}
      </footer>
    </div>
  );
};

export default HrFormsShell;
