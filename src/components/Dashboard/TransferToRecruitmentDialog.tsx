import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  applicants: { id: string; full_name: string; email?: string|null; phone?: string|null; nationality?: string|null; resume_url?: string|null }[];
  onClose: () => void;
  onTransferred: () => void;
}

export default function TransferToRecruitmentDialog({ applicants, onClose, onTransferred }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [projects, setProjects] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [projectId, setProjectId] = useState("");
  const [jobId, setJobId] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, j] = await Promise.all([
        supabase.from("recruitment_projects").select("id,code,name_ar,name_en").eq("is_active", true),
        supabase.from("recruitment_job_titles").select("id,project_id,title_ar,title_en").eq("is_active", true),
      ]);
      if (p.data) setProjects(p.data);
      if (j.data) setJobs(j.data);
    })();
  }, []);

  const filteredJobs = jobs.filter(j => !projectId || j.project_id === projectId);

  const handleTransfer = async () => {
    if (!projectId || !jobId) { toast.error(ar ? "اختر المشروع والوظيفة" : "Select project & job"); return; }
    setBusy(true);
    const rows = applicants.map(a => ({
      project_id: projectId,
      job_title_id: jobId,
      full_name: a.full_name,
      email: a.email || null,
      phone: a.phone || null,
      nationality: a.nationality || null,
      cv_url: a.resume_url || null,
      batch_label: batchLabel.trim() || null,
      status: "new" as const,
    }));
    const { error } = await supabase.from("recruitment_candidates").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(ar ? `تم نقل ${rows.length} متقدم` : `Transferred ${rows.length}`);
    onTransferred();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ar ? `نقل ${applicants.length} متقدم إلى التوظيف` : `Transfer ${applicants.length} applicants`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{ar ? "المشروع" : "Project"} *</Label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setJobId(""); }}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر مشروع" : "Select project"} /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{ar ? p.name_ar : (p.name_en || p.name_ar)} ({p.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{ar ? "الوظيفة" : "Job Title"} *</Label>
            <Select value={jobId} onValueChange={setJobId} disabled={!projectId}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر وظيفة" : "Select job"} /></SelectTrigger>
              <SelectContent>
                {filteredJobs.map(j => <SelectItem key={j.id} value={j.id}>{ar ? j.title_ar : (j.title_en || j.title_ar)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{ar ? "وسم الدفعة (اختياري)" : "Batch Label (optional)"}</Label>
            <Input value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)}
              placeholder={ar ? "مثال: مقابلات هذا الأسبوع" : "e.g. This week interviews"} />
          </div>
          <div className="text-xs text-muted-foreground">
            {ar
              ? `سيتم إنشاء سجلات جديدة في وحدة التوظيف بحالة "جديد". المتقدمون الأصليون يبقون كما هم.`
              : `New records will be created in the recruitment module with status "new". Original applicants remain unchanged.`}
          </div>
          <div className="max-h-32 overflow-auto text-xs border rounded p-2 bg-muted/30">
            {applicants.map(a => <div key={a.id}>• {a.full_name}</div>)}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={handleTransfer} disabled={busy || !projectId || !jobId}>
            {busy ? (ar ? "جاري النقل..." : "Transferring...") : (ar ? "نقل" : "Transfer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
