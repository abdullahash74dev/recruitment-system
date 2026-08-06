import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Package,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Ban,
  CheckCircle2,
  Eye,
  Loader2,
  Users as UsersIcon,
} from "lucide-react";
import {
  useSubscriptionPackagesQuery,
  useCreatePackageMutation,
  useUpdatePackageMutation,
  useDeletePackageMutation,
  useClientOrganizationsQuery,
  useCreateClientOrgMutation,
  useUpdateClientOrgMutation,
  useRenewClientOrgMutation,
  useDeleteClientOrgMutation,
  useCandidateRevealsQuery,
  type SubscriptionPackage,
  type NewSubscriptionPackage,
  type ClientOrganization,
} from "@/hooks/queries/useClientPackages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_PACKAGE: NewSubscriptionPackage = {
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  duration_months: 1,
  price: 0,
  currency: "SAR",
  credits_included: 0,
  max_users: 1,
  is_active: true,
};

const EMPTY_ORG = {
  name: "",
  contact_email: "",
  contact_phone: "",
  package_id: "",
  notes: "",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  expired: "bg-destructive/15 text-destructive",
  suspended: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

function statusLabel(status: string, ar: boolean) {
  const map: Record<string, { ar: string; en: string }> = {
    active: { ar: "نشط", en: "Active" },
    expired: { ar: "منتهي", en: "Expired" },
    suspended: { ar: "معلّق", en: "Suspended" },
  };
  return map[status] ? (ar ? map[status].ar : map[status].en) : status;
}

function formatDate(iso: string | null, ar: boolean) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(ar ? "ar-SA" : "en-US");
}

function isPastDate(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientRentalManagement() {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const { data: packages = [], isLoading: packagesLoading } = useSubscriptionPackagesQuery();
  const { data: orgs = [], isLoading: orgsLoading } = useClientOrganizationsQuery();
  const { data: allReveals = [] } = useCandidateRevealsQuery();

  const createPackage = useCreatePackageMutation();
  const updatePackage = useUpdatePackageMutation();
  const deletePackage = useDeletePackageMutation();

  const createOrg = useCreateClientOrgMutation();
  const updateOrg = useUpdateClientOrgMutation();
  const renewOrg = useRenewClientOrgMutation();
  const deleteOrg = useDeleteClientOrgMutation();

  // ---- Package dialog state ----
  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [pkgForm, setPkgForm] = useState<NewSubscriptionPackage>({ ...EMPTY_PACKAGE });

  const openCreatePackage = () => {
    setEditingPkgId(null);
    setPkgForm({ ...EMPTY_PACKAGE });
    setPkgDialogOpen(true);
  };

  const openEditPackage = (p: SubscriptionPackage) => {
    setEditingPkgId(p.id);
    setPkgForm({
      name_ar: p.name_ar,
      name_en: p.name_en,
      description_ar: p.description_ar ?? "",
      description_en: p.description_en ?? "",
      duration_months: p.duration_months,
      price: p.price,
      currency: p.currency,
      credits_included: p.credits_included,
      max_users: p.max_users,
      is_active: p.is_active,
    });
    setPkgDialogOpen(true);
  };

  const submitPackage = () => {
    if (!pkgForm.name_ar.trim() || !pkgForm.name_en.trim()) return;
    if (editingPkgId) {
      updatePackage.mutate(
        { id: editingPkgId, patch: pkgForm },
        { onSuccess: () => setPkgDialogOpen(false) }
      );
    } else {
      createPackage.mutate(pkgForm, { onSuccess: () => setPkgDialogOpen(false) });
    }
  };

  // ---- Client org dialog state ----
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [orgForm, setOrgForm] = useState({ ...EMPTY_ORG });

  const openCreateOrg = () => {
    setOrgForm({ ...EMPTY_ORG });
    setOrgDialogOpen(true);
  };

  const submitOrg = () => {
    if (!orgForm.name.trim() || !orgForm.package_id) return;
    createOrg.mutate(
      {
        name: orgForm.name,
        contact_email: orgForm.contact_email || null,
        contact_phone: orgForm.contact_phone || null,
        package_id: orgForm.package_id,
        notes: orgForm.notes || null,
      },
      { onSuccess: () => setOrgDialogOpen(false) }
    );
  };

  // ---- Renew dialog state ----
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewOrgId, setRenewOrgId] = useState<string | null>(null);
  const [renewPackageId, setRenewPackageId] = useState<string>("");

  const openRenew = (org: ClientOrganization) => {
    setRenewOrgId(org.id);
    setRenewPackageId(org.package_id ?? "");
    setRenewOpen(true);
  };

  const submitRenew = () => {
    if (!renewOrgId || !renewPackageId) return;
    renewOrg.mutate(
      { id: renewOrgId, packageId: renewPackageId },
      { onSuccess: () => setRenewOpen(false) }
    );
  };

  // ---- Reveals dialog state ----
  const [revealsOpen, setRevealsOpen] = useState(false);
  const [revealsOrg, setRevealsOrg] = useState<ClientOrganization | null>(null);
  const { data: orgReveals = [], isLoading: revealsLoading } = useCandidateRevealsQuery(revealsOrg?.id);

  const openReveals = (org: ClientOrganization) => {
    setRevealsOrg(org);
    setRevealsOpen(true);
  };

  // ---- Client users dialog state ----
  // client_users has no entry in useClientPackages.ts (that hooks file only
  // covers packages/orgs/reveals) — queried inline here since this is the
  // only place in the admin UI that needs it.
  const queryClient = useQueryClient();
  const [usersOpen, setUsersOpen] = useState(false);
  const [usersOrg, setUsersOrg] = useState<ClientOrganization | null>(null);
  const [newUserForm, setNewUserForm] = useState({ email: "", password: "", full_name: "" });
  const [creatingUser, setCreatingUser] = useState(false);

  const { data: orgUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["clientUsers", usersOrg?.id],
    enabled: !!usersOrg?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_users")
        .select("*")
        .eq("client_organization_id", usersOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; full_name: string | null; email: string | null; is_active: boolean; created_at: string }[];
    },
  });

  const openUsers = (org: ClientOrganization) => {
    setUsersOrg(org);
    setNewUserForm({ email: "", password: "", full_name: "" });
    setUsersOpen(true);
  };

  // supabase.functions.invoke() swallows the edge function's actual JSON
  // error body on a non-2xx response (its `error.message` is a generic
  // "Edge Function returned a non-2xx status code"). DashboardPage.tsx's
  // existing callManageUser() avoids this with a raw fetch that always
  // reads the body via res.json() regardless of status — mirrored here so
  // failures surface their real reason instead of a dead-end toast.
  const callManageUser = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const createClientUser = async () => {
    if (!usersOrg || !newUserForm.email.trim() || newUserForm.password.length < 6) {
      toast.error(ar ? "أدخل بريداً وكلمة مرور (6 أحرف على الأقل)" : "Enter an email and a password (6+ chars)");
      return;
    }
    setCreatingUser(true);
    try {
      const data = await callManageUser({
        action: "create_client_user",
        email: newUserForm.email.trim(),
        password: newUserForm.password,
        full_name: newUserForm.full_name.trim() || null,
        client_organization_id: usersOrg.id,
      });
      if (data?.error) throw new Error(data.error);
      toast.success(ar ? "تم إنشاء حساب المستخدم" : "User account created");
      setNewUserForm({ email: "", password: "", full_name: "" });
      queryClient.invalidateQueries({ queryKey: ["clientUsers", usersOrg.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingUser(false);
    }
  };

  const toggleClientUserActive = async (clientUserId: string, isActive: boolean) => {
    try {
      const data = await callManageUser({ action: "toggle_client_user_active", client_user_id: clientUserId, is_active: isActive });
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["clientUsers", usersOrg?.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  // ---- Stats ----
  const stats = useMemo(() => {
    const activeOrgs = orgs.filter((o) => o.subscription_status === "active").length;
    const monthStart = startOfMonthIso();
    const creditsThisMonth = allReveals.filter((r) => r.revealed_at >= monthStart).length;
    return { activeOrgs, creditsThisMonth, packagesCount: packages.length };
  }, [orgs, allReveals, packages]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Building2 className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
            <p className="text-3xl font-bold">{stats.activeOrgs}</p>
            <p className="text-sm text-muted-foreground">
              {ar ? "الشركات النشطة" : "Active Client Orgs"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Wallet className="w-6 h-6 mx-auto mb-1 text-blue-600" />
            <p className="text-3xl font-bold">{stats.creditsThisMonth}</p>
            <p className="text-sm text-muted-foreground">
              {ar ? "أرصدة مستهلكة هذا الشهر" : "Credits Consumed This Month"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Package className="w-6 h-6 mx-auto mb-1 text-purple-600" />
            <p className="text-3xl font-bold">{stats.packagesCount}</p>
            <p className="text-sm text-muted-foreground">{ar ? "عدد الباقات" : "Packages"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="packages">
        <TabsList>
          <TabsTrigger value="packages">{ar ? "الباقات" : "Packages"}</TabsTrigger>
          <TabsTrigger value="orgs">{ar ? "الشركات المستأجرة" : "Client Organizations"}</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* Packages tab                                                  */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="packages" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1" onClick={openCreatePackage}>
              <Plus className="w-4 h-4" />
              {ar ? "باقة جديدة" : "New Package"}
            </Button>
          </div>

          {packagesLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : packages.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {ar ? "لا توجد باقات" : "No packages"}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((p) => (
                <Card key={p.id} className={!p.is_active ? "opacity-60" : undefined}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{ar ? p.name_ar : p.name_en}</CardTitle>
                      <Badge
                        className={
                          p.is_active
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {p.is_active ? (ar ? "مفعّلة" : "Active") : ar ? "معطّلة" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-2xl font-bold">
                      {Number(p.price).toLocaleString()}{" "}
                      <span className="text-sm font-normal text-muted-foreground">{p.currency}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div>
                        {ar ? "المدة" : "Duration"}:{" "}
                        <span className="text-foreground font-medium">
                          {p.duration_months} {ar ? "شهر" : "mo"}
                        </span>
                      </div>
                      <div>
                        {ar ? "الأرصدة" : "Credits"}:{" "}
                        <span className="text-foreground font-medium">{p.credits_included}</span>
                      </div>
                      <div>
                        {ar ? "أقصى مستخدمين" : "Max Users"}:{" "}
                        <span className="text-foreground font-medium">{p.max_users}</span>
                      </div>
                    </div>
                    {(p.description_ar || p.description_en) && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {ar ? p.description_ar : p.description_en}
                      </p>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => openEditPackage(p)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {ar ? "تعديل" : "Edit"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (window.confirm(ar ? "تأكيد حذف الباقة؟" : "Delete this package?")) {
                            deletePackage.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* Client organizations tab                                      */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="orgs" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1" onClick={openCreateOrg}>
              <Plus className="w-4 h-4" />
              {ar ? "شركة جديدة" : "New Client Org"}
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              {orgsLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : orgs.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {ar ? "لا توجد شركات مستأجرة" : "No client organizations"}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ar ? "الشركة" : "Organization"}</TableHead>
                        <TableHead>{ar ? "الباقة" : "Package"}</TableHead>
                        <TableHead>{ar ? "الأرصدة" : "Credits"}</TableHead>
                        <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                        <TableHead>{ar ? "تاريخ الانتهاء" : "Expires"}</TableHead>
                        <TableHead>{ar ? "إجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgs.map((o) => {
                        const pkgTotal = o.subscription_packages?.credits_included ?? "—";
                        const expired = isPastDate(o.expires_at);
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">
                              {o.name}
                              <span className="block text-xs text-muted-foreground">
                                {o.contact_email || o.contact_phone || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {o.subscription_packages
                                ? ar
                                  ? o.subscription_packages.name_ar
                                  : o.subscription_packages.name_en
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {o.credits_remaining} / {pkgTotal}
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_STYLE[o.subscription_status] ?? "bg-muted"}>
                                {statusLabel(o.subscription_status, ar)}
                              </Badge>
                            </TableCell>
                            <TableCell className={expired ? "text-destructive font-medium text-sm" : "text-sm"}>
                              {formatDate(o.expires_at, ar)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={() => openRenew(o)}
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  {ar ? "تجديد" : "Renew"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={() =>
                                    updateOrg.mutate({
                                      id: o.id,
                                      patch: {
                                        subscription_status:
                                          o.subscription_status === "suspended" ? "active" : "suspended",
                                      },
                                    })
                                  }
                                >
                                  {o.subscription_status === "suspended" ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      {ar ? "تفعيل" : "Activate"}
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3.5 h-3.5" />
                                      {ar ? "تعليق" : "Suspend"}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={() => openReveals(o)}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  {ar ? "عرض" : "View"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={() => openUsers(o)}
                                >
                                  <UsersIcon className="w-3.5 h-3.5" />
                                  {ar ? "المستخدمون" : "Users"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => {
                                    if (window.confirm(ar ? "تأكيد حذف الشركة؟" : "Delete this organization?")) {
                                      deleteOrg.mutate(o.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
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
        </TabsContent>
      </Tabs>

      {/* ----------------------------------------------------------------- */}
      {/* Package create/edit dialog                                        */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPkgId ? (ar ? "تعديل الباقة" : "Edit Package") : ar ? "باقة جديدة" : "New Package"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 max-h-[70vh] overflow-y-auto pe-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "الاسم (عربي) *" : "Name (Arabic) *"}</Label>
                <Input
                  value={pkgForm.name_ar}
                  onChange={(e) => setPkgForm({ ...pkgForm, name_ar: e.target.value })}
                />
              </div>
              <div>
                <Label>{ar ? "الاسم (إنجليزي) *" : "Name (English) *"}</Label>
                <Input
                  value={pkgForm.name_en}
                  onChange={(e) => setPkgForm({ ...pkgForm, name_en: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
                <Textarea
                  rows={2}
                  value={pkgForm.description_ar ?? ""}
                  onChange={(e) => setPkgForm({ ...pkgForm, description_ar: e.target.value })}
                />
              </div>
              <div>
                <Label>{ar ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
                <Textarea
                  rows={2}
                  value={pkgForm.description_en ?? ""}
                  onChange={(e) => setPkgForm({ ...pkgForm, description_en: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "المدة (أشهر)" : "Duration (months)"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={pkgForm.duration_months}
                  onChange={(e) => setPkgForm({ ...pkgForm, duration_months: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>{ar ? "أقصى عدد مستخدمين" : "Max Users"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={pkgForm.max_users}
                  onChange={(e) => setPkgForm({ ...pkgForm, max_users: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "السعر" : "Price"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={pkgForm.price}
                  onChange={(e) => setPkgForm({ ...pkgForm, price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>{ar ? "العملة" : "Currency"}</Label>
                <Select
                  value={pkgForm.currency}
                  onValueChange={(v) => setPkgForm({ ...pkgForm, currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAR">SAR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{ar ? "الأرصدة المتضمنة" : "Credits Included"}</Label>
              <Input
                type="number"
                min={0}
                value={pkgForm.credits_included}
                onChange={(e) => setPkgForm({ ...pkgForm, credits_included: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="mb-0">{ar ? "الباقة مفعّلة" : "Package Active"}</Label>
              <Switch
                checked={pkgForm.is_active}
                onCheckedChange={(v) => setPkgForm({ ...pkgForm, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submitPackage}
              disabled={
                createPackage.isPending ||
                updatePackage.isPending ||
                !pkgForm.name_ar.trim() ||
                !pkgForm.name_en.trim()
              }
            >
              {(createPackage.isPending || updatePackage.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin me-1" />
              )}
              {ar ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Client org create dialog                                          */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ar ? "شركة مستأجرة جديدة" : "New Client Organization"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{ar ? "اسم الشركة *" : "Organization Name *"}</Label>
              <Input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{ar ? "البريد الإلكتروني" : "Contact Email"}</Label>
                <Input
                  type="email"
                  value={orgForm.contact_email}
                  onChange={(e) => setOrgForm({ ...orgForm, contact_email: e.target.value })}
                />
              </div>
              <div>
                <Label>{ar ? "رقم الجوال" : "Contact Phone"}</Label>
                <Input
                  value={orgForm.contact_phone}
                  onChange={(e) => setOrgForm({ ...orgForm, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{ar ? "الباقة *" : "Package *"}</Label>
              <Select
                value={orgForm.package_id}
                onValueChange={(v) => setOrgForm({ ...orgForm, package_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر باقة" : "Select a package"} />
                </SelectTrigger>
                <SelectContent>
                  {packages
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {ar ? p.name_ar : p.name_en} — {p.credits_included} {ar ? "رصيد" : "credits"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{ar ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                rows={2}
                value={orgForm.notes}
                onChange={(e) => setOrgForm({ ...orgForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={submitOrg}
              disabled={createOrg.isPending || !orgForm.name.trim() || !orgForm.package_id}
            >
              {createOrg.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Renew dialog                                                      */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{ar ? "تجديد الاشتراك" : "Renew Subscription"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{ar ? "الباقة" : "Package"}</Label>
              <Select value={renewPackageId} onValueChange={setRenewPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر باقة" : "Select a package"} />
                </SelectTrigger>
                <SelectContent>
                  {packages
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {ar ? p.name_ar : p.name_en} — {p.credits_included} {ar ? "رصيد" : "credits"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {ar
                  ? "سيتم إضافة أرصدة الباقة للرصيد الحالي وتمديد تاريخ الانتهاء."
                  : "The package's credits will be added on top of the current balance, and expiry extended."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submitRenew} disabled={renewOrg.isPending || !renewPackageId}>
              {renewOrg.isPending && <Loader2 className="w-4 h-4 animate-spin me-1" />}
              {ar ? "تجديد" : "Renew"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Candidate reveals dialog                                          */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={revealsOpen} onOpenChange={setRevealsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4" />
              {ar ? "سجل الكشف عن المرشحين" : "Candidate Reveals"} — {revealsOrg?.name}
            </DialogTitle>
          </DialogHeader>
          {revealsLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : orgReveals.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              {ar ? "لا توجد عمليات كشف بعد" : "No reveals yet"}
            </p>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "معرّف المتقدم" : "Applicant ID"}</TableHead>
                    <TableHead>{ar ? "بواسطة" : "Revealed By"}</TableHead>
                    <TableHead>{ar ? "التاريخ" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgReveals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-mono">{r.applicant_id}</TableCell>
                      <TableCell className="text-xs font-mono">{r.revealed_by ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(r.revealed_at).toLocaleString(ar ? "ar-SA" : "en-US")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4" />
              {ar ? "مستخدمو الشركة" : "Client Users"} — {usersOrg?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                placeholder={ar ? "الاسم" : "Full name"}
                value={newUserForm.full_name}
                onChange={(e) => setNewUserForm((f) => ({ ...f, full_name: e.target.value }))}
              />
              <Input
                type="email"
                placeholder={ar ? "البريد الإلكتروني" : "Email"}
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Input
                type="password"
                placeholder={ar ? "كلمة المرور" : "Password"}
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <Button size="sm" className="gap-1 w-full" onClick={createClientUser} disabled={creatingUser}>
              {creatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {ar ? "إنشاء حساب دخول" : "Create Login"}
            </Button>

            {usersLoading ? (
              <div className="py-6 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </div>
            ) : orgUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {ar ? "لا يوجد مستخدمون بعد" : "No users yet"}
              </p>
            ) : (
              <ScrollArea className="max-h-[40vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{ar ? "الاسم/البريد" : "Name / Email"}</TableHead>
                      <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="text-sm">
                          {u.full_name || "—"}
                          <span className="block text-xs text-muted-foreground">{u.email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={u.is_active ? STATUS_STYLE.active : "bg-muted"}>
                            {u.is_active ? (ar ? "نشط" : "Active") : (ar ? "معطّل" : "Disabled")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleClientUserActive(u.id, !u.is_active)}
                          >
                            {u.is_active ? (ar ? "تعطيل" : "Disable") : (ar ? "تفعيل" : "Enable")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
