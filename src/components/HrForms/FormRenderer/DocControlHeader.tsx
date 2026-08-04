// ISO-style document-control banner rendered at the top of every HR form:
// company branding (from site_settings — never hardcoded) plus the template's
// document number, revision and owning department.

import type { ResolvedForm } from "@/lib/hrForms/templateEngine";

interface Props {
  resolved: ResolvedForm;
  lang: "en" | "ar";
}

const DocControlHeader = ({ resolved, lang }: Props) => {
  const { template, branding } = resolved;
  const title = (lang === "ar" && template.title_ar) || template.title_en;

  return (
    <div className="border border-border rounded-t-md overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/40">
        <div className="flex items-center gap-3 min-w-0">
          {branding.logoUrl && (
            <img src={branding.logoUrl} alt="" className="h-12 w-auto object-contain shrink-0" crossOrigin="anonymous" />
          )}
          <div className="min-w-0">
            <div className="font-bold text-base truncate">{branding.companyNameEn}</div>
            <div className="text-sm text-muted-foreground truncate" dir="rtl">{branding.companyNameAr}</div>
          </div>
        </div>
        <div className="text-end shrink-0">
          <div className="font-semibold">{title}</div>
          {lang !== "ar" && template.title_ar && (
            <div className="text-sm text-muted-foreground" dir="rtl">{template.title_ar}</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 text-xs border-t border-border divide-x divide-border rtl:divide-x-reverse">
        <div className="px-3 py-2">
          <span className="text-muted-foreground block">{lang === "ar" ? "رقم النموذج" : "Document No."}</span>
          <span className="font-medium">{template.doc_no || "—"}</span>
        </div>
        <div className="px-3 py-2">
          <span className="text-muted-foreground block">{lang === "ar" ? "رقم المراجعة" : "Revision No."}</span>
          <span className="font-medium">{template.revision_no ?? template.version}</span>
        </div>
        <div className="px-3 py-2">
          <span className="text-muted-foreground block">{lang === "ar" ? "تاريخ المراجعة" : "Revision Date"}</span>
          <span className="font-medium">{template.revision_date || "—"}</span>
        </div>
        <div className="px-3 py-2">
          <span className="text-muted-foreground block">{lang === "ar" ? "الإدارة" : "Department"}</span>
          <span className="font-medium">{template.department_owner || "—"}</span>
        </div>
      </div>
    </div>
  );
};

export default DocControlHeader;
