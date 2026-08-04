// HR Forms module shell: its own layout and nested routes, mounted at
// /admin/hr-forms/* behind AdminGuard. Kept out of DashboardPage on purpose —
// this module is a full sub-app, not another dashboard tab.

import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, LayoutTemplate, Moon, Sun, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import CatalogPage from "./CatalogPage";
import EmployeesPage from "./EmployeesPage";
import FillFormPage from "./FillFormPage";
import TemplateBuilderListPage from "./TemplateBuilderListPage";
import TemplateBuilderEditorPage from "./TemplateBuilderEditorPage";

const HrFormsShell = () => {
  const { lang, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { role, hasPermission, loading } = useUserPermissions();
  const isAdmin = role === "admin";

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
    { to: "/admin/hr-forms/catalog", icon: FileText, en: "Forms Catalog", ar: "دليل النماذج", show: true },
    { to: "/admin/hr-forms/employees", icon: Users, en: "Employees", ar: "الموظفون", show: isAdmin || hasPermission("hr_forms.view_employees") },
    { to: "/admin/hr-forms/templates", icon: LayoutTemplate, en: "Template Builder", ar: "منشئ القوالب", show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir={dir}>
      <header className="border-b border-border px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-20">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} title={lang === "ar" ? "لوحة التحكم" : "Dashboard"}>
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Button>
        <h1 className="font-bold text-lg">{lang === "ar" ? "نماذج الموارد البشرية" : "HR Forms"}</h1>
        <nav className="ms-6 hidden md:flex items-center gap-1">
          {navItems.filter((i) => i.show).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {lang === "ar" ? item.ar : item.en}
            </NavLink>
          ))}
        </nav>
        <div className="ms-auto">
          <Button variant="ghost" size="icon" onClick={toggleTheme} title={lang === "ar" ? "الوضع الليلي/النهاري" : "Toggle theme"}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden flex border-b border-border">
        {navItems.filter((i) => i.show).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs ${
                isActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {lang === "ar" ? item.ar : item.en}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        <Routes>
          <Route index element={<Navigate to="catalog" replace />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="fill/:templateId" element={<FillFormPage />} />
          <Route path="templates" element={<TemplateBuilderListPage />} />
          <Route path="templates/:templateId" element={<TemplateBuilderEditorPage />} />
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
