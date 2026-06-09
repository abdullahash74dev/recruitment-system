import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmailRow {
  id: string;
  template_key: string;
  recipient_email: string;
  language: string;
  subject: string | null;
  send_status: string;
  sent_by_email: string | null;
  created_at: string;
  rejection_note: string | null;
}

export default function ApplicantEmailHistory({ applicantId }: { applicantId: string }) {
  const [rows, setRows] = useState<EmailRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("applicant_emails")
        .select("*")
        .eq("applicant_id", applicantId)
        .order("created_at", { ascending: false });
      setRows(data || []);
    })();
  }, [applicantId]);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">سجل الإيميلات المرسلة</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="border border-border rounded-lg p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge>{r.template_key}</Badge>
              <Badge variant="outline">{r.language}</Badge>
              <Badge variant={r.send_status === "sent" ? "default" : "secondary"}>{r.send_status}</Badge>
              <span className="text-xs text-muted-foreground ms-auto">
                {new Date(r.created_at).toLocaleString("ar-SA")}
              </span>
            </div>
            <p className="font-medium">{r.subject}</p>
            <p className="text-xs text-muted-foreground">إلى: {r.recipient_email} • بواسطة: {r.sent_by_email || "—"}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
