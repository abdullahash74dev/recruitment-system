import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import SiteLogo from "@/components/SiteLogo";
import AuroraBackground from "@/components/AuroraBackground";
import { useSiteContent } from "@/hooks/useSiteContent";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Briefcase, ArrowLeft, ArrowRight, Search, LogIn, Flag, Hash, CheckCircle2 } from "lucide-react";

interface JobPosting {
  id: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  location: string;
  location_en: string | null;
  job_type: string;
  job_type_en: string | null;
  department: string | null;
  department_en: string | null;
  requirements_ar: string | null;
  requirements_en: string | null;
  is_active: boolean;
  nationality_required: string | null;
  nationality_required_en: string | null;
  vacancy_count: number;
  created_at: string;
}

const JobsPage = () => {
  const { t, dir, lang } = useLanguage();
  const { settings } = useSiteSettings();
  const { content } = useSiteContent();
  const s: any = settings;
  const showNat = (content as any).show_nationality_on_jobs;
  const groupByLocation = !!s.jobs_group_by_location;
  const showCompleted = !!s.jobs_show_completed;
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [completedJobs, setCompletedJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const siteName = lang === "ar" ? settings.site_name_ar : settings.site_name_en;

  useEffect(() => {
    fetchJobs();
  }, [showCompleted]);

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("job_postings")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      const all = (data as any[]).filter(
        (j) => !j.posting_category || j.posting_category === "job",
      );
      setJobs(all.filter((j) => j.is_active) as JobPosting[]);
      setCompletedJobs(all.filter((j) => !j.is_active) as JobPosting[]);
    }
    setLoading(false);
  };

  const matchesSearch = (job: JobPosting) => {
    const title = lang === "ar" ? job.title_ar : (job.title_en || job.title_ar);
    const dept = lang === "ar" ? (job.department || "") : (job.department_en || job.department || "");
    const loc = lang === "ar" ? (job.location || "") : (job.location_en || job.location || "");
    const q = searchTerm.toLowerCase();
    return title.toLowerCase().includes(q) ||
      dept.toLowerCase().includes(q) ||
      loc.toLowerCase().includes(q);
  };

  const filtered = useMemo(() => jobs.filter(matchesSearch), [jobs, searchTerm, lang]);
  const filteredCompleted = useMemo(() => completedJobs.filter(matchesSearch), [completedJobs, searchTerm, lang]);

  const biField = (ar: string | null, en: string | null) =>
    lang === "ar" ? (ar || en || "") : (en || ar || "");

  // Group active jobs by location label (uses current language)
  const grouped = useMemo(() => {
    const map = new Map<string, JobPosting[]>();
    for (const j of filtered) {
      const key = biField(j.location, j.location_en).trim() ||
        (lang === "ar" ? s.jobs_other_label_ar || "مناطق أخرى" : s.jobs_other_label_en || "Other locations");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered, lang, s.jobs_other_label_ar, s.jobs_other_label_en]);

  const sectionTitle = (loc: string) => {
    const prefix = lang === "ar" ? (s.jobs_section_title_ar || "وظائف") : (s.jobs_section_title_en || "Jobs in");
    return `${prefix} ${loc}`;
  };

  const completedTitle = lang === "ar"
    ? (s.jobs_completed_label_ar || "وظائف مكتملة")
    : (s.jobs_completed_label_en || "Filled positions");

  const renderCard = (job: JobPosting, isCompleted = false) => {
    const title = lang === "ar" ? job.title_ar : (job.title_en || job.title_ar);
    const natLabel = showNat ? (biField(job.nationality_required, job.nationality_required_en) || null) : null;
    return (
      <div
        key={job.id}
        className={`bg-card rounded-xl border border-border transition-all duration-300 overflow-hidden flex flex-col ${
          isCompleted ? "opacity-70 grayscale-[40%]" : "hover:shadow-lg"
        }`}
      >
        <div className="p-6 flex-1">
          <div className="flex items-start justify-between mb-5">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-muted-foreground" />
            </div>
            {isCompleted ? (
              <Badge className="bg-muted text-muted-foreground border-0 font-medium gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {completedTitle}
              </Badge>
            ) : (
              <Badge className="bg-accent/10 text-accent border-0 font-medium">
                {t("jobs.available")} · {job.vacancy_count} {t("jobs.vacancies")}
              </Badge>
            )}
          </div>

          <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
          <p className="text-muted-foreground text-sm mb-2">{biField(job.department, job.department_en) || (lang === "ar" ? "عام" : "General")}</p>
          {(lang === "ar" ? job.description_ar : (job.description_en || job.description_ar)) && (
            <p className="text-muted-foreground text-xs mb-4 line-clamp-2">
              {lang === "ar" ? job.description_ar : (job.description_en || job.description_ar)}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-accent shrink-0" />
              <span>{biField(job.location, job.location_en)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-accent shrink-0" />
              <span>{biField(job.job_type, job.job_type_en)}</span>
            </div>
            {natLabel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Flag className="w-4 h-4 text-accent shrink-0" />
                <span>{natLabel}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 space-y-2">
          <Link to={`/jobs/${job.id}`} className="block">
            <Button
              className="w-full bg-foreground text-background hover:bg-foreground/90 gap-2 rounded-lg font-semibold py-5"
              disabled={isCompleted}
            >
              {isCompleted ? completedTitle : t("jobDetail.viewDetails")}
              {!isCompleted && <Arrow className="w-4 h-4" />}
            </Button>
          </Link>
        </div>
      </div>
    );
  };

  const SectionHeader = ({ title, count, tone = "accent" }: { title: string; count: number; tone?: "accent" | "muted" }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className={`h-10 w-1.5 rounded-full ${tone === "accent" ? "bg-accent" : "bg-muted-foreground/40"}`} />
      <div className="flex-1">
        <h2 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-3 flex-wrap">
          {tone === "muted" && <CheckCircle2 className="w-6 h-6 text-muted-foreground" />}
          {tone === "accent" && <MapPin className="w-6 h-6 text-accent" />}
          {title}
          <Badge className={`${tone === "accent" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"} border-0 text-sm`}>
            {count}
          </Badge>
        </h2>
      </div>
    </div>
  );

  const totalActive = filtered.length;

  return (
    <div className="min-h-screen bg-background relative" dir={dir}>
      <AuroraBackground />
      <nav className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-6">
          <div className="flex items-center gap-6">
            <Link to="/">
              <SiteLogo className="h-10" />
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors font-medium">{t("nav.home")}</Link>
              <Link to="/jobs" className="text-accent font-semibold">{t("nav.jobs")}</Link>
              <Link to="/training" className="text-muted-foreground hover:text-foreground transition-colors font-medium">{t("nav.training")}</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TopBar variant="dark" />
          </div>
        </div>
      </nav>

      <section className="bg-muted/30 py-16 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-black text-foreground mb-4">{t("jobs.title")}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("jobs.desc")}</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 rounded-full px-5 py-2 font-semibold">
            <Hash className="w-4 h-4" />
            {lang === "ar" ? `${totalActive} وظيفة متاحة حالياً` : `${totalActive} jobs available now`}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 -mt-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 w-5 h-5 text-muted-foreground" style={{ [dir === "rtl" ? "right" : "left"]: "0.75rem" }} />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t("jobs.searchPlaceholder")}
              className="border-0 bg-transparent shadow-none"
              style={{ [dir === "rtl" ? "paddingRight" : "paddingLeft"]: "2.5rem" }}
            />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : totalActive === 0 && (!showCompleted || filteredCompleted.length === 0) ? (
          <div className="text-center py-20">
            <Briefcase className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">{t("jobs.noJobs")}</p>
            <Link to="/apply" className="inline-block mt-6">
              <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2 rounded-full px-8">
                {t("nav.apply")}
                <Arrow className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        ) : groupByLocation ? (
          <div className="space-y-14">
            {grouped.map(([loc, list]) => (
              <section key={loc}>
                <SectionHeader title={sectionTitle(loc)} count={list.length} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {list.map((j) => renderCard(j))}
                </div>
              </section>
            ))}
            {showCompleted && filteredCompleted.length > 0 && (
              <section>
                <SectionHeader title={completedTitle} count={filteredCompleted.length} tone="muted" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCompleted.map((j) => renderCard(j, true))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((j) => renderCard(j))}
            </div>
            {showCompleted && filteredCompleted.length > 0 && (
              <section className="mt-14">
                <SectionHeader title={completedTitle} count={filteredCompleted.length} tone="muted" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCompleted.map((j) => renderCard(j, true))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="bg-card border-t border-border py-6 px-4 mt-10">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {siteName} - {t("footer.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default JobsPage;
