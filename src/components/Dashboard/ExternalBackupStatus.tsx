import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CloudUpload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useExternalBackupStatusQuery } from "@/hooks/queries/useExternalBackupStatus";

const KIND_LABELS: Record<string, { ar: string; en: string }> = {
  resume: { ar: "السيرة الذاتية", en: "Résumé" },
  degree: { ar: "الشهادة", en: "Degree" },
  training: { ar: "شهادات التدريب", en: "Training certs" },
  other: { ar: "مستندات أخرى", en: "Other docs" },
};

const DESTINATION_LABELS: Record<string, string> = {
  onedrive: "OneDrive",
  googledrive: "Google Drive",
};

/**
 * Read-only view of scripts/onedrive-backup and scripts/googledrive-backup's
 * progress -- this dashboard never writes to external_backups (only those
 * offline scripts do, via the service-role key). Lets an admin see, without
 * touching a terminal, which résumés still have no off-platform copy yet.
 */
export default function ExternalBackupStatus() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data, isLoading } = useExternalBackupStatusQuery();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CloudUpload className="w-4 h-4" />
          {ar ? "النسخ الاحتياطي الخارجي" : "External Backup"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {ar
            ? "نسخة موازية من السير الذاتية (وبقية المستندات إن فُعّلت) في حساباتك الشخصية على OneDrive و/أو Google Drive، مستقلة عن Supabase. تُدار عبر أدوات scripts/onedrive-backup و scripts/googledrive-backup التي تُشغَّل من جهازك -- راجع ملفات README.md بداخلها."
            : "A parallel copy of résumés (and other documents if enabled) in your own OneDrive and/or Google Drive accounts, independent of Supabase. Managed by the scripts/onedrive-backup and scripts/googledrive-backup tools run from your machine -- see their README.md files."}
        </p>

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data || data.every((d) => d.byKind.length === 0) ? (
          <p className="text-xs text-muted-foreground">
            {ar ? "لا توجد سير ذاتية مرفوعة بعد ليتم نسخها احتياطياً." : "No résumés uploaded yet to back up."}
          </p>
        ) : (
          data.map((dest) => (
            <div key={dest.destination} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">{DESTINATION_LABELS[dest.destination] || dest.destination}</p>
              {dest.byKind.length === 0 ? (
                <p className="text-xs text-muted-foreground">{ar ? "لم يتم تشغيل الأداة بعد." : "The tool hasn't been run yet."}</p>
              ) : (
                <div className="space-y-2">
                  {dest.byKind.map((k) => {
                    const pending = Math.max(0, k.total - k.backedUp);
                    return (
                      <div key={k.kind} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                        <span>{ar ? KIND_LABELS[k.kind]?.ar ?? k.kind : KIND_LABELS[k.kind]?.en ?? k.kind}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="border-emerald-600/40 text-emerald-600">
                            {ar ? `منسوخ: ${k.backedUp}` : `Backed up: ${k.backedUp}`}
                          </Badge>
                          {pending > 0 && (
                            <Badge variant="outline" className="border-amber-600/40 text-amber-600">
                              {ar ? `ناقص: ${pending}` : `Pending: ${pending}`}
                            </Badge>
                          )}
                          {k.failed > 0 && (
                            <Badge variant="outline" className="border-destructive/40 text-destructive">
                              {ar ? `فشل: ${k.failed}` : `Failed: ${k.failed}`}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {dest.lastBackedUpAt && (
                <p className="text-xs text-muted-foreground">
                  {ar ? "آخر عملية نسخ: " : "Last backup run: "}
                  {new Date(dest.lastBackedUpAt).toLocaleString(ar ? "ar" : "en")}
                </p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
