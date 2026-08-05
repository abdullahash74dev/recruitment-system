// Admin usage log: the append-only issuance ledger — every document ever
// issued, for whom, by whom, in which formats — with signed download links
// into the private storage bucket.

import { useMemo, useState } from "react";
import { Download, History, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { getIssuedFileUrl, useHrFormIssuancesQuery } from "@/hooks/queries/useHrForms";

const UsageLogPage = () => {
  const { lang } = useLanguage();
  const { role } = useUserPermissions();
  const { data: issuances = [], isLoading } = useHrFormIssuancesQuery();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return issuances;
    return issuances.filter((i) =>
      [i.template_title, i.employee_name, i.issued_by_email].some((s) => s?.toLowerCase().includes(q)),
    );
  }, [issuances, search]);

  if (role !== "admin") {
    return <div className="text-center py-12 text-muted-foreground">{lang === "ar" ? "سجل الاستخدام لمدير النظام فقط." : "The usage log is restricted to administrators."}</div>;
  }

  const openFile = async (path: string) => {
    try {
      window.open(await getIssuedFileUrl(path), "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <History className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{lang === "ar" ? "سجل الإصدارات" : "Usage Log"}</h2>
        <Badge variant="secondary">{issuances.length}</Badge>
        <div className="relative ms-auto w-full sm:w-72">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder={lang === "ar" ? "ابحث بالنموذج أو الموظف..." : "Search by form or employee..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border border-border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-start font-medium">{lang === "ar" ? "النموذج" : "Form"}</th>
              <th className="px-3 py-2 text-start font-medium">{lang === "ar" ? "الموظف" : "Employee"}</th>
              <th className="px-3 py-2 text-start font-medium hidden md:table-cell">{lang === "ar" ? "أصدره" : "Issued By"}</th>
              <th className="px-3 py-2 text-start font-medium">{lang === "ar" ? "التاريخ" : "Date"}</th>
              <th className="px-3 py-2 text-start font-medium">{lang === "ar" ? "الملفات" : "Files"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{lang === "ar" ? "جارٍ التحميل..." : "Loading..."}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                {lang === "ar" ? "لا توجد إصدارات بعد." : "No issued documents yet."}
              </td></tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{i.template_title}</td>
                  <td className="px-3 py-2">{i.employee_name ?? "—"}</td>
                  <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{i.issued_by_email ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(i.issued_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {Object.entries(i.file_urls ?? {}).map(([format, path]) => (
                        <Button
                          key={format}
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openFile(path)}
                        >
                          <Download className="h-3 w-3 me-1" />
                          {format.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsageLogPage;
