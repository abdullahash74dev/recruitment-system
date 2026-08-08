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

/**
 * Read-only view of scripts/onedrive-backup's progress -- this dashboard
 * never writes to external_backups (only that offline script does, via the
 * service-role key). Lets an admin see, without touching a terminal, which
 * résumés still have no off-platform OneDrive copy yet.
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
          {ar ? "النسخ الاحتياطي الخارجي (OneDrive)" : "External Backup (OneDrive)"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {ar
            ? "نسخة موازية من السير الذاتية (وبقية المستندات إن فُعّلت) في حساب OneDrive الخاص بك، مستقلة عن Supabase. تُدار عبر أداة scripts/onedrive-backup التي تُشغَّل من جهازك -- راجع الملف README.md بداخلها."
            : "A parallel copy of résumés (and other documents if enabled) in your own OneDrive account, independent of Supabase. Managed by the scripts/onedrive-backup tool run from your machine -- see its README.md."}
        </p>

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data || data.byKind.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {ar ? "لم يتم تشغيل أداة النسخ الاحتياطي بعد." : "The backup tool hasn't been run yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {data.byKind.map((k) => {
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
            {data.lastBackedUpAt && (
              <p className="text-xs text-muted-foreground">
                {ar ? "آخر عملية نسخ: " : "Last backup run: "}
                {new Date(data.lastBackedUpAt).toLocaleString(ar ? "ar" : "en")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
