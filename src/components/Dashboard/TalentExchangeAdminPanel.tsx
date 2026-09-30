import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Users2 } from "lucide-react";
import {
  useAllTalentExchangeListingsQuery,
  useWithdrawTalentExchangeListingMutation,
  type TalentExchangeStatus,
} from "@/hooks/queries/useTalentExchange";

const STATUS_STYLE: Record<TalentExchangeStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_consent: "bg-amber-500/15 text-amber-600",
  active: "bg-emerald-500/15 text-emerald-600",
  withdrawn: "bg-muted text-muted-foreground",
  expired: "bg-destructive/15 text-destructive",
};

/** Read-only oversight for admins, with a moderation "force withdraw" -- the
 * releasing/hiring workflow itself always happens in the client portal. */
export default function TalentExchangeAdminPanel() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { data: listings = [], isLoading } = useAllTalentExchangeListingsQuery();
  const withdraw = useWithdrawTalentExchangeListingMutation(lang);

  const STATUS_LABEL = (s: TalentExchangeStatus) =>
    ({
      draft: ar ? "مسودة" : "Draft",
      pending_consent: ar ? "بانتظار الموظف" : "Awaiting employee",
      active: ar ? "نشط" : "Active",
      withdrawn: ar ? "مسحوب" : "Withdrawn",
      expired: ar ? "منتهي" : "Expired",
    })[s];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users2 className="w-5 h-5" />
        <h3 className="text-lg font-bold">{ar ? "سوق إعادة توظيف الكفاءات" : "Talent Redeployment Exchange"}</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "إشراف على كل الإعلانات بين الشركات. السحب هنا يُستخدم للإشراف فقط (مثل مخالفة الشروط)."
          : "Oversight across all companies' listings. Withdrawing here is for moderation only (e.g. a policy violation)."}
      </p>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{ar ? "جارٍ التحميل..." : "Loading..."}</p>
          ) : listings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{ar ? "لا توجد إعلانات بعد" : "No listings yet"}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "الشركة المُعلنة" : "Releasing company"}</TableHead>
                    <TableHead>{ar ? "الموظف" : "Employee"}</TableHead>
                    <TableHead>{ar ? "الوظيفة" : "Position"}</TableHead>
                    <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{ar ? "تاريخ الإنشاء" : "Created"}</TableHead>
                    <TableHead className="text-end">{ar ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.client_organizations?.name ?? "—"}</TableCell>
                      <TableCell>{l.employee_full_name}</TableCell>
                      <TableCell>{l.position_title}</TableCell>
                      <TableCell><Badge className={STATUS_STYLE[l.status]}>{STATUS_LABEL(l.status)}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(l.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}</TableCell>
                      <TableCell className="text-end">
                        {l.status !== "withdrawn" && (
                          <Button size="sm" variant="ghost" className="text-destructive gap-1.5" onClick={() => withdraw.mutate(l.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                            {ar ? "سحب" : "Withdraw"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
