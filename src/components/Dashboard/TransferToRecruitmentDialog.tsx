import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecruitmentProjectsQuery } from "@/hooks/queries/useRecruitmentProjects";
import { useRecruitmentJobTitlesQuery } from "@/hooks/queries/useRecruitmentJobTitles";
import { useTransferApplicantsToRecruitmentMutation } from "@/hooks/queries/useRecruitmentCandidates";

interface Props {
  applicants: { id: string; full_name: string; email?: string|null; phone?: string|null; nationality?: string|null; resume_url?: string|null }[];
  onClose: () => void;
  onTransferred: () => void;
}

export default function TransferToRecruitmentDialog({ applicants, onClose, onTransferred }: Props) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: allProjects = [] } = useRecruitmentProjectsQuery();
  const { data: allJobs = [] } = useRecruitmentJobTitlesQuery();
  const projects = useMemo(() => allProjects.filter((p) => p.is_active), [allProjects]);
  const jobs = useMemo(() => allJobs.filter((j) => j.is_active), [allJobs]);
  const transferMutation = useTransferApplicantsToRecruitmentMutation();
  const [projectId, setProjectId] = useState("");
  const [jobId, setJobId] = useState("");
  const [batchLabel, setBatchLabel] = useState("");

  const filteredJobs = jobs.filter(j => !projectId || j.project_id === projectId);

  const handleTransfer = async () => {
    if (!projectId || !jobId) { toast.error(ar ? "اختر المشروع والوظيفة" : "Select project & job"); return; }
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
    try {
      const count = await transferMutation.mutateAsync(rows);
      toast.success(ar ? `تم نقل ${count} متقدم` : `Transferred ${count}`);
      onTransferred();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
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
          <Button onClick={handleTransfer} disabled={transferMutation.isPending || !projectId || !jobId}>
            {transferMutation.isPending ? (ar ? "جاري النقل..." : "Transferring...") : (ar ? "نقل" : "Transfer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
