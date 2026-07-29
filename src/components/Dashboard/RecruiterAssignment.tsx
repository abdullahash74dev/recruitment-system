import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCog2, Plus, Trash2, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfilesQuery } from "@/hooks/queries/useUsersAndRoles";
import {
  useRecruiterAssignmentsQuery,
  useAssignRecruiterMutation,
  useUnassignRecruiterMutation,
} from "@/hooks/queries/useRecruiterAssignments";

export default function RecruiterAssignment() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: assignments = [], isLoading } = useRecruiterAssignmentsQuery();
  const { data: profiles = [] } = useProfilesQuery();
  const assignMutation = useAssignRecruiterMutation();
  const unassignMutation = useUnassignRecruiterMutation();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedApplicant, setSelectedApplicant] = useState<{ id: string; full_name: string } | null>(null);
  const [selectedRecruiter, setSelectedRecruiter] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("all");

  // Applicant lookup for the assign dialog — server-side ilike so we never pull
  // the whole table just to pick one person.
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["recruiterAssignments", "applicantSearch", search],
    enabled: open && search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applicants")
        .select("id, full_name, desired_position")
        .ilike("full_name", `%${search.trim()}%`)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const workload = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const a of assignments) {
      const key = a.recruiter_id ?? "unassigned";
      const profile = profiles.find((p) => p.id === a.recruiter_id);
      const name = profile?.full_name || profile?.email || a.recruiter_email || (ar ? "غير معروف" : "Unknown");
      const entry = map.get(key) ?? { name, count: 0 };
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count);
  }, [assignments, profiles, ar]);

  const filtered = useMemo(
    () => assignments.filter((a) => recruiterFilter === "all" || a.recruiter_id === recruiterFilter),
    [assignments, recruiterFilter]
  );

  const submit = () => {
    if (!selectedApplicant || !selectedRecruiter) return;
    const profile = profiles.find((p) => p.id === selectedRecruiter);
    assignMutation.mutate(
      {
        applicant_id: selectedApplicant.id,
        recruiter_id: selectedRecruiter,
        recruiter_email: profile?.email ?? null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setSelectedApplicant(null);
          setSelectedRecruiter("");
          setSearch("");
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{ar ? "توزيع الأعمال على المجندين" : "Recruiter Workload"}</CardTitle></CardHeader>
        <CardContent>
          {workload.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">{ar ? "لا توجد تعيينات بعد" : "No assignments yet"}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {workload.map((w) => (
                <Card key={w.id} className="border-primary/20">
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold text-primary">{w.count}</p>
                    <p className="text-sm truncate" title={w.name}>{w.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <UserCog2 className="w-5 h-5" />{ar ? "تعيين المجندين" : "Recruiter Assignment"}
            </CardTitle>
            <div className="flex gap-2">
              <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كل المجندين" : "All recruiters"}</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
                <Plus className="w-4 h-4" />{ar ? "تعيين" : "Assign"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{ar ? "لا توجد تعيينات" : "No assignments"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "المتقدم" : "Applicant"}</TableHead>
                    <TableHead>{ar ? "المجنّد" : "Recruiter"}</TableHead>
                    <TableHead>{ar ? "حالة المتقدم" : "Status"}</TableHead>
                    <TableHead>{ar ? "تاريخ التعيين" : "Assigned"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const profile = profiles.find((p) => p.id === a.recruiter_id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.applicant_name || "—"}</TableCell>
                        <TableCell>{profile?.full_name || profile?.email || a.recruiter_email || "—"}</TableCell>
                        <TableCell>
                          {a.applicant_status && <Badge variant="outline">{a.applicant_status}</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(a.assigned_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive"
                            onClick={() => unassignMutation.mutate(a.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ar ? "تعيين مجنّد لمتقدم" : "Assign Recruiter"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{ar ? "ابحث عن المتقدم" : "Search Applicant"}</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-8" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedApplicant(null); }}
                  placeholder={ar ? "اكتب حرفين على الأقل..." : "Type at least 2 characters..."} />
              </div>
              {selectedApplicant ? (
                <Badge className="mt-2 bg-primary/15 text-primary">{selectedApplicant.full_name}</Badge>
              ) : search.trim().length >= 2 && (
                <ScrollArea className="h-40 mt-2 border rounded">
                  {searching ? (
                    <div className="py-6 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                  ) : searchResults.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{ar ? "لا نتائج" : "No results"}</p>
                  ) : (
                    searchResults.map((r) => (
                      <button key={r.id} type="button"
                        className="w-full text-start px-3 py-2 hover:bg-accent text-sm border-b last:border-0"
                        onClick={() => setSelectedApplicant({ id: r.id, full_name: r.full_name })}>
                        {r.full_name}
                        <span className="block text-xs text-muted-foreground">{r.desired_position || "—"}</span>
                      </button>
                    ))
                  )}
                </ScrollArea>
              )}
            </div>
            <div>
              <Label>{ar ? "المجنّد" : "Recruiter"}</Label>
              <Select value={selectedRecruiter} onValueChange={setSelectedRecruiter}>
                <SelectTrigger><SelectValue placeholder={ar ? "اختر المجنّد" : "Select recruiter"} /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submit} disabled={!selectedApplicant || !selectedRecruiter || assignMutation.isPending}>
              {assignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "تعيين" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
