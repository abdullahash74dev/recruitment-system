// Employee master data: the single shared source every form auto-fills from.
// Admins (or holders of hr_forms.manage_employees) create/edit; viewers with
// hr_forms.view_employees get a read-only list.

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  type EmployeeInput,
  useCreateEmployeeMutation,
  useDeleteEmployeeMutation,
  useEmployeesQuery,
  useUpdateEmployeeMutation,
} from "@/hooks/queries/useHrForms";
import type { Employee } from "@/lib/hrForms/types";

const EMPLOYMENT_TYPES = ["permanent", "contract", "part_time", "probation"] as const;
const STATUSES = ["active", "on_leave", "terminated", "resigned"] as const;

const emptyInput: EmployeeInput = { full_name_en: "" };

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  on_leave: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  terminated: "bg-red-500/15 text-red-600 dark:text-red-400",
  resigned: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

const EmployeesPage = () => {
  const { lang } = useLanguage();
  const { role, hasPermission } = useUserPermissions();
  const canManage = role === "admin" || hasPermission("hr_forms.manage_employees");

  const { data: employees = [], isLoading } = useEmployeesQuery();
  const createEmployee = useCreateEmployeeMutation();
  const updateEmployee = useUpdateEmployeeMutation();
  const deleteEmployee = useDeleteEmployeeMutation();

  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmployeeInput>(emptyInput);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.full_name_en, e.full_name_ar, e.employee_no, e.department, e.job_title, e.work_email]
        .some((s) => s?.toLowerCase().includes(q)),
    );
  }, [employees, search]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyInput);
    setEditorOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    const { id, created_at, updated_at, created_by, source_applicant_id, extra, ...rest } = emp;
    setDraft({ ...rest });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.full_name_en?.trim()) return;
    if (editingId) {
      await updateEmployee.mutateAsync({ id: editingId, patch: draft });
    } else {
      await createEmployee.mutateAsync(draft);
    }
    setEditorOpen(false);
  };

  const set = (patch: Partial<EmployeeInput>) => setDraft((d) => ({ ...d, ...patch }));

  const text = (key: keyof EmployeeInput, labelEn: string, labelAr: string, type = "text", dir?: "ltr" | "rtl") => (
    <div className="space-y-1">
      <Label className="text-xs">{lang === "ar" ? labelAr : labelEn}</Label>
      <Input
        type={type}
        dir={dir}
        value={(draft[key] as string | number | null) ?? ""}
        onChange={(e) =>
          set({ [key]: type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : (e.target.value || null) })
        }
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold">{lang === "ar" ? "الموظفون" : "Employees"}</h2>
        <Badge variant="secondary">{employees.length}</Badge>
        <div className="relative ms-auto w-full sm:w-72">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder={lang === "ar" ? "ابحث..." : "Search..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 me-1" />
            {lang === "ar" ? "إضافة موظف" : "Add Employee"}
          </Button>
        )}
      </div>

      <div className="border border-border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-start">
              <th className="px-3 py-2 text-start font-medium">{lang === "ar" ? "الاسم" : "Name"}</th>
              <th className="px-3 py-2 text-start font-medium">{lang === "ar" ? "الرقم الوظيفي" : "Employee No."}</th>
              <th className="px-3 py-2 text-start font-medium hidden md:table-cell">{lang === "ar" ? "الإدارة" : "Department"}</th>
              <th className="px-3 py-2 text-start font-medium hidden md:table-cell">{lang === "ar" ? "المسمى" : "Job Title"}</th>
              <th className="px-3 py-2 text-start font-medium">{lang === "ar" ? "الحالة" : "Status"}</th>
              {canManage && <th className="px-3 py-2 w-24" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                {lang === "ar" ? "لا يوجد موظفون بعد — أضف أول موظف ليصبح مصدر البيانات المشترك لكل النماذج." : "No employees yet — add your first employee to become the shared data source for every form."}
              </td></tr>
            ) : (
              filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{emp.full_name_en}</div>
                        {emp.full_name_ar && <div dir="rtl" className="text-xs text-muted-foreground truncate">{emp.full_name_ar}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{emp.employee_no ?? "—"}</td>
                  <td className="px-3 py-2 hidden md:table-cell">{emp.department ?? "—"}</td>
                  <td className="px-3 py-2 hidden md:table-cell">{emp.job_title ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[emp.status] ?? ""}`}>{emp.status}</span>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(emp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(emp)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? (lang === "ar" ? "تعديل موظف" : "Edit Employee")
                : (lang === "ar" ? "إضافة موظف" : "Add Employee")}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {text("full_name_en", "Full Name (EN) *", "الاسم الكامل (إنجليزي) *")}
            {text("full_name_ar", "Full Name (AR)", "الاسم الكامل (عربي)", "text", "rtl")}
            {text("employee_no", "Employee No.", "الرقم الوظيفي", "text", "ltr")}
            {text("national_id", "National ID / Iqama", "رقم الهوية / الإقامة", "text", "ltr")}
            {text("passport_no", "Passport No.", "رقم الجواز", "text", "ltr")}
            {text("nationality", "Nationality", "الجنسية")}
            <div className="space-y-1">
              <Label className="text-xs">{lang === "ar" ? "الجنس" : "Gender"}</Label>
              <Select value={draft.gender ?? ""} onValueChange={(v) => set({ gender: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{lang === "ar" ? "ذكر" : "Male"}</SelectItem>
                  <SelectItem value="female">{lang === "ar" ? "أنثى" : "Female"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {text("birth_date", "Date of Birth", "تاريخ الميلاد", "date", "ltr")}
            <div className="space-y-1">
              <Label className="text-xs">{lang === "ar" ? "الحالة الاجتماعية" : "Marital Status"}</Label>
              <Select value={draft.marital_status ?? ""} onValueChange={(v) => set({ marital_status: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{lang === "ar" ? "أعزب" : "Single"}</SelectItem>
                  <SelectItem value="married">{lang === "ar" ? "متزوج" : "Married"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {text("phone", "Phone", "الجوال", "text", "ltr")}
            {text("personal_email", "Personal Email", "البريد الشخصي", "text", "ltr")}
            {text("work_email", "Work Email", "بريد العمل", "text", "ltr")}
            {text("department", "Department", "الإدارة")}
            {text("job_title", "Job Title", "المسمى الوظيفي")}
            <div className="space-y-1">
              <Label className="text-xs">{lang === "ar" ? "نوع التوظيف" : "Employment Type"}</Label>
              <Select value={draft.employment_type ?? ""} onValueChange={(v) => set({ employment_type: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {text("hire_date", "Hire Date", "تاريخ الالتحاق", "date", "ltr")}
            {text("base_salary", "Basic Salary", "الراتب الأساسي", "number", "ltr")}
            {text("housing_allowance", "Housing Allowance", "بدل السكن", "number", "ltr")}
            {text("transport_allowance", "Transport Allowance", "بدل المواصلات", "number", "ltr")}
            {text("bank_name", "Bank Name", "اسم البنك")}
            {text("bank_iban", "IBAN", "الآيبان", "text", "ltr")}
            {text("bank_account_no", "Account No.", "رقم الحساب", "text", "ltr")}
            <div className="space-y-1">
              <Label className="text-xs">{lang === "ar" ? "الحالة" : "Status"}</Label>
              <Select value={draft.status ?? "active"} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={save} disabled={!draft.full_name_en?.trim() || createEmployee.isPending || updateEmployee.isPending}>
              {lang === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "ar" ? "حذف الموظف؟" : "Delete employee?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? `سيُنقل «${deleteTarget?.full_name_en}» إلى سلة المحذوفات ويمكن استعادته من هناك.`
                : `"${deleteTarget?.full_name_en}" will be moved to Trash and can be restored from there.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteEmployee.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {lang === "ar" ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeesPage;
