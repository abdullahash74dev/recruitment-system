import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSiteContent } from "@/hooks/useSiteContent";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, GraduationCap, ArrowLeft, ArrowRight, Search, Hash, Flag } from "lucide-react";

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
  is_active: boolean;
  posting_category: string | null;
  nationality_required: string | null;
  nationality_required_en: string | null;
  vacancy_count: number;
  created_at: string;
}

const TrainingPage = () => {
  const { t, dir, lang } = useLanguage();
  const { settings } = useSiteSettings();
  const { content } = useSiteContent();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const siteName = lang === "ar" ? settings.site_name_ar : settings.site_name_en;

  useEffect(() => {
    supabase
      .from("job_postings")
      .select("*")
      .eq("is_active", true)
      .in("posting_category", ["coop", "tamheer", "training"])
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setJobs(data as JobPosting[]);
        setLoading(false);
      });
  }, []);

  const filtered = jobs.filter((job) => {
    const title = lang === "ar" ? job.title_ar : job.title_en || job.title_ar;
    const dept = lang === "ar" ? job.department || "" : job.department_en || job.department || "";
    return (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const bi = (ar: string | null, en: string | null) =>
    lang === "ar" ? ar || en || "" : en || ar || "";

  const showNat = (content as any).show_nationality_on_jobs;

  const trainingTitle = lang === "ar"
    ? ((settings as any).training_page_title_ar || "فرص التدريب التعاوني وتمهير")
    : ((settings as any).training_page_title_en || "Co-op Training & Tamheer Opportunities");
  const trainingDesc = lang === "ar"
    ? ((settings as any).training_page_desc_ar || "انضم لبرامج التدريب التعاوني وتمهير في منصة التوظيف الذكية")
    : ((settings as any).training_page_desc_en || "Join our Co-op and Tamheer training programs at NexHire AI");

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <nav className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between py-3 px-6">
          <div className="flex items-center gap-6">
            <Link to="/">
              <div className="flex items-center gap-2">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt={siteName || ""} className="h-10 w-auto object-contain" />
                ) : (
                  <span className="text-xl font-black" style={{ color: settings.primary_color }}>{siteName}</span>
                )}
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                {t("nav.home")}
              </Link>
              <Link to="/jobs" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                {t("nav.jobs")}
              </Link>
              <Link to="/training" className="text-accent font-semibold">
                {t("nav.training")}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TopBar variant="dark" />
          </div>
        </div>
      </nav>

      <section className="bg-muted/30 py-16 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-4 bg-accent/10 text-accent px-4 py-1.5 rounded-full text-sm font-bold">
            <GraduationCap className="w-4 h-4" />
            {lang === "ar" ? "تدريب تعاوني / تمهير" : "Co-op / Tamheer"}
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mb-4">{trainingTitle}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{trainingDesc}</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 rounded-full px-5 py-2 font-semibold">
            <Hash className="w-4 h-4" />
            {lang === "ar" ? `${filtered.length} فرصة تدريب متاحة` : `${filtered.length} training opportunities`}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 -mt-6">
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute top-2.5 w-5 h-5 text-muted-foreground"
              style={{ [dir === "rtl" ? "right" : "left"]: "0.75rem" }}
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">{t("training.noJobs")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((job) => {
              const title = lang === "ar" ? job.title_ar : job.title_en || job.title_ar;
              const natLabel = bi(job.nationality_required, job.nationality_required_en) || null;
              return (
                <div key={job.id} className="bg-card rounded-xl border border-border hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-accent" />
                      </div>
                      <Badge className="bg-accent/10 text-accent border-0 font-medium">
                        {job.posting_category === "tamheer" ? "تمهير" : (lang === "ar" ? "تدريب تعاوني" : "Co-op")}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {bi(job.department, job.department_en) || (lang === "ar" ? "عام" : "General")}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 text-accent shrink-0" />
                        <span>{bi(job.location, job.location_en)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 text-accent shrink-0" />
                        <span>{bi(job.job_type, job.job_type_en)}</span>
                      </div>
                      {showNat && natLabel && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Flag className="w-4 h-4 text-accent shrink-0" />
                          <span>{natLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-6 pb-6 space-y-2">
                    <Link to={`/jobs/${job.id}`} className="block">
                      <Button className="w-full bg-foreground text-background hover:bg-foreground/90 gap-2 rounded-lg font-semibold py-5">
                        {t("jobDetail.viewDetails")}
                        <Arrow className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
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

export default TrainingPage;
