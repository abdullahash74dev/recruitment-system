import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Share2,
  Plus,
  Loader2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Eye,
  Users,
  Globe,
  KeyRound,
} from "lucide-react";
import {
  useJobBoardAccountsQuery,
  useUpdateBoardAccountMutation,
  useJobBoardPublicationsQuery,
  useCreatePublicationMutation,
  useUpdatePublicationMutation,
  useDeletePublicationMutation,
  useJobPostingsForPublishingQuery,
  BOARD_LABEL,
  type JobBoard,
  type JobBoardAccount,
  type PublicationStatus,
} from "@/hooks/queries/useJobBoardPublishing";

const STATUS_STYLE: Record<PublicationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  queued: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  failed: "bg-destructive/15 text-destructive",
  expired: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  removed: "bg-muted text-muted-foreground line-through",
};

const STATUS_LABEL = (s: PublicationStatus, ar: boolean) =>
  ar
    ? {
        draft: "مسودة",
        queued: "في الانتظار",
        published: "منشور",
        failed: "فشل",
        expired: "منتهي",
        removed: "محذوف",
      }[s]
    : {
        draft: "Draft",
        queued: "Queued",
        published: "Published",
        failed: "Failed",
        expired: "Expired",
        removed: "Removed",
      }[s];

const boardName = (account: JobBoardAccount | undefined, board: JobBoard) =>
  account?.display_name?.trim() || BOARD_LABEL[board] || board;

interface PublishForm {
  job_posting_id: string;
  boards: JobBoard[];
  external_url: string;
  expires_at: string;
}

const EMPTY_FORM: PublishForm = { job_posting_id: "", boards: [], external_url: "", expires_at: "" };

export default function JobBoardPublishing() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const locale = ar ? "ar-EG" : "en-US";

  const { data: accounts = [], isLoading: accountsLoading } = useJobBoardAccountsQuery();
  const { data: publications = [], isLoading: publicationsLoading } = useJobBoardPublicationsQuery();
  const { data: postings = [], isLoading: postingsLoading } = useJobPostingsForPublishingQuery();
  const updateAccount = useUpdateBoardAccountMutation();
  const createPublication = useCreatePublicationMutation();
  const updatePublication = useUpdatePublicationMutation();
  const deletePublication = useDeletePublicationMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PublishForm>(EMPTY_FORM);
  // Identifier inputs are uncontrolled-ish: edits live here until blur so every
  // keystroke doesn't fire an update.
  const [identifierDrafts, setIdentifierDrafts] = useState<Record<string, string>>({});

  const accountByBoard = useMemo(() => {
    const map = new Map<JobBoard, JobBoardAccount>();
    accounts.forEach((a) => map.set(a.board, a));
    return map;
  }, [accounts]);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts]);

  const stats = useMemo(() => {
    const published = publications.filter((p) => p.status === "published");
    return {
      activeBoards: activeAccounts.length,
      published: published.length,
      views: publications.reduce((sum, p) => sum + (p.view_count ?? 0), 0),
      applicants: publications.reduce((sum, p) => sum + (p.applicant_count ?? 0), 0),
    };
  }, [publications, activeAccounts]);

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "—";

  const toggleBoard = (board: JobBoard) =>
    setForm((prev) => ({
      ...prev,
      boards: prev.boards.includes(board) ? prev.boards.filter((b) => b !== board) : [...prev.boards, board],
    }));

  const commitIdentifier = (account: JobBoardAccount) => {
    const draft = identifierDrafts[account.id];
    if (draft === undefined) return;
    const next = draft.trim();
    if (next === (account.account_identifier ?? "")) return;
    updateAccount.mutate({ id: account.id, patch: { account_identifier: next || null } });
  };

  const selectedPosting = postings.find((p) => p.id === form.job_posting_id);

  const submitPublish = () => {
    if (!selectedPosting || form.boards.length === 0) return;
    createPublication.mutate(
      {
        job_posting_id: selectedPosting.id,
        job_title: selectedPosting.title_ar || selectedPosting.title_en || "",
        boards: form.boards,
        external_url: form.external_url,
        expires_at: form.expires_at || null,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setForm(EMPTY_FORM);
        },
      }
    );
  };

  const markPublished = (id: string) =>
    updatePublication.mutate({
      id,
      patch: { status: "published", published_at: new Date().toISOString(), error_detail: null },
    });

  const markFailed = (id: string) =>
    updatePublication.mutate({
      id,
      patch: {
        status: "failed",
        error_detail: ar ? "تم وضع علامة فشل يدوياً" : "Manually marked as failed",
      },
    });

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* Stats                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{stats.activeBoards}</p>
            <p className="text-sm text-muted-foreground">{ar ? "مواقع مفعّلة" : "Active Boards"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-emerald-600">{stats.published}</p>
            <p className="text-sm text-muted-foreground">{ar ? "إعلانات منشورة" : "Published Listings"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.views.toLocaleString(locale)}</p>
            <p className="text-sm text-muted-foreground">{ar ? "إجمالي المشاهدات" : "Total Views"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-amber-600">{stats.applicants.toLocaleString(locale)}</p>
            <p className="text-sm text-muted-foreground">
              {ar ? "متقدمون من المواقع" : "Applicants from Boards"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Boards                                                             */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {ar ? "حسابات مواقع التوظيف" : "Job Board Accounts"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <KeyRound className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              {ar
                ? "النشر التلقائي عبر واجهات البرمجة يتطلب إضافة مفتاح API الخاص بكل موقع كسرّ في وظائف Edge. حتى ذلك الحين يتم النشر يدوياً على كل موقع ويُسجَّل رابط الإعلان هنا للمتابعة."
                : "Automatic API publishing requires each board's API key to be stored as an edge-function secret. Until then, publish manually on each board and record the listing URL here for tracking."}
            </p>
          </div>

          {accountsLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {ar ? "لا توجد مواقع توظيف معرّفة" : "No job boards configured"}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {accounts.map((account) => (
                <Card key={account.id} className={account.is_active ? "border-primary/40" : "border-border"}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{boardName(account, account.board)}</p>
                        <p className="text-xs text-muted-foreground">
                          {account.is_active
                            ? ar
                              ? "مفعّل كوجهة نشر"
                              : "Enabled as a publishing target"
                            : ar
                              ? "غير مفعّل"
                              : "Not enabled"}
                        </p>
                      </div>
                      <Switch
                        checked={!!account.is_active}
                        onCheckedChange={(checked) =>
                          updateAccount.mutate({ id: account.id, patch: { is_active: checked } })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{ar ? "معرّف الحساب" : "Account Identifier"}</Label>
                      <Input
                        className="h-8"
                        value={identifierDrafts[account.id] ?? account.account_identifier ?? ""}
                        placeholder={ar ? "اسم صفحة الشركة أو رقم الحساب" : "Company page or employer id"}
                        onChange={(e) =>
                          setIdentifierDrafts((prev) => ({ ...prev, [account.id]: e.target.value }))
                        }
                        onBlur={() => commitIdentifier(account)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Publications                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              {ar ? "الإعلانات المنشورة" : "Job Listings"}
            </CardTitle>
            <Button
              size="sm"
              className="gap-1"
              disabled={activeAccounts.length === 0 || postings.length === 0}
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-4 h-4" />
              {ar ? "نشر وظيفة" : "Publish a Job"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {publicationsLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : publications.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {activeAccounts.length === 0
                ? ar
                  ? "فعّل موقع توظيف واحداً على الأقل للبدء"
                  : "Enable at least one job board to get started"
                : ar
                  ? "لا توجد إعلانات بعد"
                  : "No listings yet"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "الوظيفة" : "Job Title"}</TableHead>
                    <TableHead>{ar ? "الموقع" : "Board"}</TableHead>
                    <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{ar ? "الرابط" : "Link"}</TableHead>
                    <TableHead>{ar ? "المشاهدات" : "Views"}</TableHead>
                    <TableHead>{ar ? "المتقدمون" : "Applicants"}</TableHead>
                    <TableHead>{ar ? "تاريخ النشر" : "Published"}</TableHead>
                    <TableHead className="text-end">{ar ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publications.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium max-w-[16rem] truncate">{p.job_title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{boardName(accountByBoard.get(p.board), p.board)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={STATUS_STYLE[p.status]}>{STATUS_LABEL(p.status, ar)}</Badge>
                          {p.status === "failed" && p.error_detail && (
                            <span className="text-xs text-destructive max-w-[12rem] truncate">
                              {p.error_detail}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.external_url ? (
                          <a
                            href={p.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {ar ? "عرض" : "Open"}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          {(p.view_count ?? 0).toLocaleString(locale)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          {(p.applicant_count ?? 0).toLocaleString(locale)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(p.published_at)}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1"
                            disabled={p.status === "published"}
                            onClick={() => markPublished(p.id)}
                            title={ar ? "تحديد كمنشور" : "Mark as published"}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{ar ? "منشور" : "Published"}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1"
                            disabled={p.status === "failed"}
                            onClick={() => markFailed(p.id)}
                            title={ar ? "تحديد كفاشل" : "Mark as failed"}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{ar ? "فشل" : "Failed"}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive"
                            onClick={() => deletePublication.mutate(p.id)}
                            title={ar ? "حذف" : "Delete"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Publish dialog                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setForm(EMPTY_FORM);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ar ? "نشر وظيفة على مواقع التوظيف" : "Publish a Job to Boards"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{ar ? "الوظيفة" : "Job Posting"}</Label>
              <Select
                value={form.job_posting_id}
                onValueChange={(v) => setForm((prev) => ({ ...prev, job_posting_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      postingsLoading
                        ? ar
                          ? "جارٍ التحميل..."
                          : "Loading..."
                        : ar
                          ? "اختر وظيفة نشطة"
                          : "Select an active job"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {postings.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title_ar || job.title_en || job.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "المواقع" : "Boards"}</Label>
              {activeAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {ar ? "لا توجد مواقع مفعّلة" : "No active boards"}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeAccounts.map((account) => (
                    <label
                      key={account.id}
                      className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={form.boards.includes(account.board)}
                        onCheckedChange={() => toggleBoard(account.board)}
                      />
                      <span className="truncate">{boardName(account, account.board)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "رابط الإعلان (اختياري)" : "Listing URL (optional)"}</Label>
              <Input
                dir="ltr"
                placeholder="https://..."
                value={form.external_url}
                onChange={(e) => setForm((prev) => ({ ...prev, external_url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "يُطبَّق نفس الرابط على كل المواقع المختارة — يمكن تعديله لاحقاً لكل إعلان."
                  : "The same URL is applied to every selected board — edit it per listing later."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{ar ? "تاريخ الانتهاء (اختياري)" : "Expiry Date (optional)"}</Label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submitPublish}
              disabled={!form.job_posting_id || form.boards.length === 0 || createPublication.isPending}
            >
              {createPublication.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {ar
                ? `إنشاء ${form.boards.length || ""} مسودة`.trim()
                : `Create ${form.boards.length || ""} draft${form.boards.length === 1 ? "" : "s"}`.replace(
                    /\s+/g,
                    " "
                  )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
