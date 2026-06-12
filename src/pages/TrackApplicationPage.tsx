import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import TopBar from "@/components/TopBar";
import SiteLogo from "@/components/SiteLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, ArrowLeft, ArrowRight, FileSearch, Clock, Phone, Users, CheckCircle2, XCircle,
} from "lucide-react";

interface TrackResult {
  id: string;
  desired_position: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const STAGES = ["new", "reviewing", "phone_interview", "in_person_interview", "hired"] as const;
const STAGE_ICONS = [FileSearch, Clock, Phone, Users, CheckCircle2];
const NEGATIVE_STATUSES = ["rejected", "withdrawn"];

const ApplicationStatusCard = ({ result }: { result: TrackResult }) => {
  const { t, lang } = useLanguage();
  const isNegative = NEGATIVE_STATUSES.includes(result.status);
  const normalizedStatus = result.status === "accepted" ? "hired" : result.status;
  const idx = STAGES.indexOf(normalizedStatus as typeof STAGES[number]);
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US");

  return (
    <Card className="shadow-card">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm text-muted-foreground">{t("track.position")}</div>
            <div className="font-bold text-lg">{result.desired_position || "—"}</div>
          </div>
          <Badge variant="secondary" className={isNegative ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent-foreground"}>
            {t(`status.${result.status}`)}
          </Badge>
        </div>

        {!isNegative && idx >= 0 && (
          <div className="space-y-2 pt-2" dir="ltr">
            <div className="flex items-center">
              {STAGES.map((s, i) => {
                const Icon = STAGE_ICONS[i];
                const reached = i <= idx;
                return (
                  <div key={s} className="flex-1 flex items-center last:flex-none">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${reached ? "gradient-accent text-accent-foreground shadow-glow" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={`flex-1 h-1 mx-1 rounded ${i < idx ? "bg-accent" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex text-[11px] text-muted-foreground">
              {STAGES.map((s) => (
                <span key={s} className="flex-1 text-center first:text-start last:text-end last:flex-none">
                  {t(`status.${s}`)}
                </span>
              ))}
            </div>
          </div>
        )}

        {isNegative && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="w-4 h-4" />
            {result.status === "rejected"
              ? (lang === "ar" ? "تم إغلاق هذا الطلب دون المتابعة" : "This application was not moved forward")
              : (lang === "ar" ? "تم سحب هذا الطلب" : "This application was withdrawn")}
          </div>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border">
          <span>{t("track.appliedOn")}: {dateFmt(result.created_at)}</span>
          <span>{t("track.lastUpdate")}: {dateFmt(result.updated_at)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const TrackApplicationPage = () => {
  const { t, dir, lang } = useLanguage();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TrackResult[] | null>(null);
  const [error, setError] = useState("");
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  const handleSearch = async () => {
    if (!email.trim() || !phone.trim()) { setError(t("validation.required")); return; }
    setLoading(true);
    setError("");
    setResults(null);
    const { data, error: err } = await supabase.rpc("track_application_status", {
      _email: email.trim(),
      _phone: phone.trim(),
    });
    setLoading(false);
    if (err) { setError(t("track.error")); return; }
    setResults((data as TrackResult[]) || []);
  };

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <header className="gradient-hero py-6 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/"><SiteLogo heightOverride={40} /></Link>
          <TopBar variant="light" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-black text-primary">{t("track.title")}</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("track.subtitle")}</p>
        </div>

        <Card className="shadow-elevated">
          <CardContent className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("track.email")}</Label>
                <Input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("track.phone")}</Label>
                <Input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSearch} disabled={loading} className="w-full gradient-accent text-accent-foreground gap-2 font-semibold">
              <Search className="w-4 h-4" />
              {loading ? t("track.checking") : t("track.submit")}
            </Button>
          </CardContent>
        </Card>

        {results !== null && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t("track.results")}</h2>
            {results.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                  <FileSearch className="w-10 h-10 opacity-50" />
                  {t("track.notFound")}
                </CardContent>
              </Card>
            ) : (
              results.map((r) => <ApplicationStatusCard key={r.id} result={r} />)
            )}
          </div>
        )}

        <div className="text-center pt-4">
          <Link to="/" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            <BackArrow className="w-3.5 h-3.5" />
            {t("track.backHome")}
          </Link>
        </div>
      </main>
    </div>
  );
};

export default TrackApplicationPage;
