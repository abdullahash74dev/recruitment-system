import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Lock, Mail, Phone, Sparkles, Unlock, UserRound, SearchX } from "lucide-react";
import {
  useClientJobMatchMutation,
  useRevealCandidateMutation,
  type ClientJobMatchResult,
} from "@/hooks/queries/useClientPortalSearch";

interface ClientJobMatchDialogProps {
  lang: "ar" | "en";
  open: boolean;
  onClose: () => void;
  onViewProfile: (id: string) => void;
}

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : "—");

function scoreBadgeClass(score: number): string {
  if (score >= 70) return "border-emerald-600/40 text-emerald-600";
  if (score >= 40) return "border-amber-600/40 text-amber-600";
  return "border-muted-foreground/30 text-muted-foreground";
}

/**
 * "Search by job description" -- pastes a job description, gets an
 * AI-ranked shortlist via `client-ai-job-match` (keyword-narrowed pool of
 * ~40 candidates, scored + a one-line reason in a single AI call). Kept as
 * its own dialog rather than a third portal tab so it doesn't disturb the
 * existing search/revealed tab state -- it's a one-shot lookup, not a
 * persistent view.
 */
export default function ClientJobMatchDialog({ lang, open, onClose, onViewProfile }: ClientJobMatchDialogProps) {
  const ar = lang === "ar";
  const [jobDescription, setJobDescription] = useState("");
  const [results, setResults] = useState<ClientJobMatchResult[] | null>(null);
  const [candidatesScanned, setCandidatesScanned] = useState(0);

  const matchMutation = useClientJobMatchMutation(lang);
  const revealMutation = useRevealCandidateMutation(lang);
  const revealingId = revealMutation.isPending ? (revealMutation.variables as string) : null;

  const runSearch = () => {
    if (jobDescription.trim().length < 10) return;
    matchMutation.mutate(jobDescription, {
      onSuccess: (data) => {
        setResults(data.results);
        setCandidatesScanned(data.candidates_scanned);
      },
    });
  };

  const reveal = (id: string) => {
    revealMutation.mutate(id, {
      onSuccess: (data) => {
        setResults((prev) =>
          prev
            ? prev.map((r) =>
                r.id === id ? { ...r, is_revealed: true, phone: data.phone, email: data.email } : r
              )
            : prev
        );
      },
    });
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            {ar ? "بحث ذكي بوصف الوظيفة" : "Smart search by job description"}
          </DialogTitle>
        </DialogHeader>

        <div dir={ar ? "rtl" : "ltr"} className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          <div className="space-y-2">
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder={
                ar
                  ? "الصق وصف الوظيفة هنا (المسمى، المتطلبات، الخبرة المطلوبة...) وسيقترح النظام أنسب المرشحين تلقائياً"
                  : "Paste the job description here (title, requirements, experience needed...) and the system will suggest the best-fit candidates"
              }
              rows={6}
              className="resize-none"
            />
            <Button onClick={runSearch} disabled={jobDescription.trim().length < 10 || matchMutation.isPending}>
              {matchMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin ms-1.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 ms-1.5" />
              )}
              {ar ? "ابحث عن أنسب المرشحين" : "Find best-fit candidates"}
            </Button>
          </div>

          {results !== null && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {ar
                  ? `تم فحص ${candidatesScanned} مرشح مبدئياً — أفضل ${results.length} نتيجة أدناه`
                  : `Scanned ${candidatesScanned} candidates initially — top ${results.length} results below`}
              </p>

              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-md border py-12 text-center text-muted-foreground">
                  <SearchX className="h-8 w-8 opacity-50" />
                  <p className="text-sm">{ar ? "لم يُعثر على مرشحين مناسبين" : "No matching candidates found"}</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ar ? "التوافق" : "Match"}</TableHead>
                        <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
                        <TableHead>{ar ? "السبب" : "Reason"}</TableHead>
                        <TableHead>{ar ? "بيانات الاتصال" : "Contact"}</TableHead>
                        <TableHead>{ar ? "الملف" : "Profile"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r) => {
                        const isRevealing = revealingId === r.id;
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Badge variant="outline" className={scoreBadgeClass(r.score)}>
                                {r.score}%
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              <div>{dash(r.full_name)}</div>
                              <div className="text-xs text-muted-foreground">{dash(r.desired_position)}</div>
                            </TableCell>
                            <TableCell className="max-w-[220px] text-xs text-muted-foreground">{dash(r.reason)}</TableCell>
                            <TableCell>
                              {r.is_revealed ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span dir="ltr">{dash(r.phone)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-sm">
                                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span dir="ltr">{dash(r.email)}</span>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={isRevealing}
                                  onClick={() => reveal(r.id)}
                                >
                                  {isRevealing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin ms-1.5" />
                                  ) : (
                                    <Unlock className="h-3.5 w-3.5 ms-1.5" />
                                  )}
                                  {ar ? "كشف" : "Reveal"}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => onViewProfile(r.id)}>
                                <UserRound className="h-3.5 w-3.5 ms-1.5" />
                                {ar ? "عرض" : "View"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
