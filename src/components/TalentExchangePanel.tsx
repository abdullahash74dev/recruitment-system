import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, Wallet, MapPin, Plus, Send, Trash2, Unlock, Mail, Phone, Users2 } from "lucide-react";
import {
  useMyTalentExchangeListingsQuery,
  useCreateTalentExchangeListingMutation,
  useWithdrawTalentExchangeListingMutation,
  useSendTalentExchangeConsentMutation,
  useTalentExchangeBrowseQuery,
  useRevealTalentExchangeListingMutation,
  type ReleaseReasonCategory,
  type TalentExchangeStatus,
} from "@/hooks/queries/useTalentExchange";

const REASON_LABELS: Record<ReleaseReasonCategory, { ar: string; en: string }> = {
  cost_reduction: { ar: "تقليص التكاليف", en: "Cost reduction" },
  restructuring: { ar: "إعادة هيكلة", en: "Restructuring" },
  contract_end: { ar: "انتهاء العقد", en: "Contract end" },
  relocation: { ar: "نقل موقع العمل", en: "Relocation" },
  other: { ar: "سبب آخر", en: "Other" },
};

const STATUS_LABELS: Record<TalentExchangeStatus, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  pending_consent: { ar: "بانتظار موافقة الموظف", en: "Awaiting employee consent" },
  active: { ar: "نشط", en: "Active" },
  withdrawn: { ar: "مسحوب", en: "Withdrawn" },
  expired: { ar: "منتهي", en: "Expired" },
};

const EMPTY_FORM = {
  employee_full_name: "",
  employee_contact_email: "",
  employee_contact_phone: "",
  position_title: "",
  job_level: "",
  current_salary: "",
  current_work_location: "",
  release_reason_category: "other" as ReleaseReasonCategory,
  release_reason_note: "",
};

export default function TalentExchangePanel() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [tab, setTab] = useState<"browse" | "mine">("browse");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users2 className="w-5 h-5" />
        <h3 className="text-lg font-bold">{ar ? "سوق إعادة توظيف الكفاءات" : "Talent Redeployment Exchange"}</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "شركة تنوي الاستغناء عن موظف تنشر بياناته الوظيفية مجهولة الهوية هنا، وشركات أخرى تكشف بيانات التواصل مقابل رصيد لتوظيفه مباشرة. لا يظهر اسم الموظف لأي طرف إلا بعد موافقته الصريحة."
          : "A company releasing an employee posts their anonymized job data here; other companies reveal contact info for a credit to hire them directly. The employee's name is never shown until they explicitly consent."}
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "browse" | "mine")}>
        <TabsList>
          <TabsTrigger value="browse">{ar ? "استعراض الكفاءات المتاحة" : "Browse available talent"}</TabsTrigger>
          <TabsTrigger value="mine">{ar ? "إعلاناتي" : "My listings"}</TabsTrigger>
        </TabsList>
        <TabsContent value="browse" className="mt-4">
          <BrowseTab ar={ar} />
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          <MyListingsTab ar={ar} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BrowseTab({ ar }: { ar: boolean }) {
  const { data: rows = [], isLoading } = useTalentExchangeBrowseQuery();
  const reveal = useRevealTalentExchangeListingMutation(ar ? "ar" : "en");
  const [revealed, setRevealed] = useState<Record<string, Awaited<ReturnType<typeof reveal.mutateAsync>>>>({});

  const handleReveal = async (id: string) => {
    const result = await reveal.mutateAsync(id);
    setRevealed((r) => ({ ...r, [id]: result }));
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">{ar ? "جارٍ التحميل..." : "Loading..."}</p>;
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{ar ? "لا توجد كفاءات متاحة حالياً" : "No talent listed right now"}</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((row) => {
        const details = revealed[row.id];
        const isRevealed = row.is_revealed_by_me || !!details;
        return (
          <Card key={row.id}>
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{row.position_title}{row.job_level ? ` — ${row.job_level}` : ""}</span>
              </div>
              {row.current_salary != null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="w-3.5 h-3.5" />
                  {ar ? "الراتب الحالي" : "Current salary"}: {row.current_salary}
                </div>
              )}
              {row.current_work_location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  {row.current_work_location}
                </div>
              )}
              <Badge variant="outline">{REASON_LABELS[row.release_reason_category]?.[ar ? "ar" : "en"] ?? row.release_reason_category}</Badge>
              {row.release_reason_note && <p className="text-xs text-muted-foreground">{row.release_reason_note}</p>}

              {isRevealed ? (
                <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-2.5 space-y-1 text-sm">
                  {details ? (
                    <>
                      <p className="font-semibold">{details.employee_full_name}</p>
                      <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{details.employee_contact_email}</p>
                      {details.employee_contact_phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{details.employee_contact_phone}</p>}
                      {details.releasing_company_name && (
                        <p className="text-xs text-muted-foreground">{ar ? "الشركة المُعلنة" : "Releasing company"}: {details.releasing_company_name}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{ar ? "تم كشف هذه البيانات سابقاً" : "Already revealed"}</p>
                  )}
                </div>
              ) : (
                <Button size="sm" className="w-full gap-1.5" onClick={() => handleReveal(row.id)} disabled={reveal.isPending}>
                  <Unlock className="w-3.5 h-3.5" />
                  {ar ? "كشف بيانات التواصل (رصيد واحد)" : "Reveal contact info (1 credit)"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MyListingsTab({ ar }: { ar: boolean }) {
  const { data: listings = [], isLoading } = useMyTalentExchangeListingsQuery();
  const createListing = useCreateTalentExchangeListingMutation(ar ? "ar" : "en");
  const withdrawListing = useWithdrawTalentExchangeListingMutation(ar ? "ar" : "en");
  const sendConsent = useSendTalentExchangeConsentMutation(ar ? "ar" : "en");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const submit = () => {
    if (!form.employee_full_name.trim() || !form.employee_contact_email.trim() || !form.position_title.trim()) return;
    createListing.mutate(
      {
        employee_full_name: form.employee_full_name.trim(),
        employee_contact_email: form.employee_contact_email.trim(),
        employee_contact_phone: form.employee_contact_phone.trim() || undefined,
        position_title: form.position_title.trim(),
        job_level: form.job_level.trim() || undefined,
        current_salary: form.current_salary ? Number(form.current_salary) : undefined,
        current_work_location: form.current_work_location.trim() || undefined,
        release_reason_category: form.release_reason_category,
        release_reason_note: form.release_reason_note.trim() || undefined,
      },
      { onSuccess: () => { setDialogOpen(false); setForm(EMPTY_FORM); } }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          {ar ? "نشر كفاءة للتوظيف البديل" : "List an employee for redeployment"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{ar ? "جارٍ التحميل..." : "Loading..."}</p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{ar ? "لا توجد إعلانات بعد" : "No listings yet"}</p>
      ) : (
        <div className="space-y-2">
          {listings.map((l) => (
            <div key={l.id} className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium">{l.employee_full_name} — {l.position_title}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline">{STATUS_LABELS[l.status][ar ? "ar" : "en"]}</Badge>
                  {l.status === "pending_consent" && (
                    <Badge variant="outline" className="border-amber-600/40 text-amber-600">
                      {ar ? "بانتظار رد الموظف" : "Awaiting employee reply"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                {(l.status === "draft" || l.status === "pending_consent") && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => sendConsent.mutate(l.id)} disabled={sendConsent.isPending}>
                    <Send className="w-3.5 h-3.5" />
                    {l.status === "draft" ? (ar ? "إرسال رابط الموافقة" : "Send consent link") : (ar ? "إعادة الإرسال" : "Resend")}
                  </Button>
                )}
                {l.status !== "withdrawn" && (
                  <Button size="sm" variant="ghost" className="text-destructive gap-1.5" onClick={() => withdrawListing.mutate(l.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                    {ar ? "سحب" : "Withdraw"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ar ? "نشر كفاءة للتوظيف البديل" : "List an employee for redeployment"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "اسم الموظف" : "Employee name"}</Label>
                <Input value={form.employee_full_name} onChange={(e) => setForm((f) => ({ ...f, employee_full_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "بريد الموظف (لإرسال رابط الموافقة)" : "Employee email (for the consent link)"}</Label>
                <Input type="email" value={form.employee_contact_email} onChange={(e) => setForm((f) => ({ ...f, employee_contact_email: e.target.value }))} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "جوال الموظف (اختياري)" : "Employee phone (optional)"}</Label>
                <Input value={form.employee_contact_phone} onChange={(e) => setForm((f) => ({ ...f, employee_contact_phone: e.target.value }))} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "المسمى الوظيفي" : "Position title"}</Label>
                <Input value={form.position_title} onChange={(e) => setForm((f) => ({ ...f, position_title: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "الرتبة الوظيفية" : "Job level"}</Label>
                <Input value={form.job_level} onChange={(e) => setForm((f) => ({ ...f, job_level: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "الراتب الحالي" : "Current salary"}</Label>
                <Input type="number" value={form.current_salary} onChange={(e) => setForm((f) => ({ ...f, current_salary: e.target.value }))} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "موقع العمل الحالي" : "Current work location"}</Label>
                <Input value={form.current_work_location} onChange={(e) => setForm((f) => ({ ...f, current_work_location: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "سبب الاستغناء" : "Release reason"}</Label>
                <Select value={form.release_reason_category} onValueChange={(v) => setForm((f) => ({ ...f, release_reason_category: v as ReleaseReasonCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label[ar ? "ar" : "en"]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "ملاحظة إضافية (ستظهر للشركات، بدون اسم)" : "Extra note (shown to other companies, no name)"}</Label>
              <Textarea value={form.release_reason_note} onChange={(e) => setForm((f) => ({ ...f, release_reason_note: e.target.value }))} className="min-h-[70px]" />
            </div>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "بعد الحفظ، لازم تضغط \"إرسال رابط الموافقة\" ليصل بريد للموظف يوافق فيه صريحاً قبل ما يصير إعلانه مرئياً لأي شركة."
                : "After saving, click \"Send consent link\" so the employee gets an email to explicitly confirm before their listing becomes visible to any company."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submit} disabled={createListing.isPending}>{ar ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
