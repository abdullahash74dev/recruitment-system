import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Users, Briefcase, Building2, Search, Star, Globe, Shield, Zap, Calendar, FolderOpen, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/TopBar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteContent } from "@/hooks/useSiteContent";
import { supabase } from "@/integrations/supabase/client";
import StorageImage from "@/components/StorageImage";
import ProjectLogo from "@/components/ProjectLogo";
import SiteLogo from "@/components/SiteLogo";
import AINetworkBackground from "@/components/AINetworkBackground";
import AuroraBackground from "@/components/AuroraBackground";
import heroBg from "@/assets/hero-bg.jpg";

interface Project {
  id: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  logo_url: string | null;
  is_active: boolean;
  logo_height?: number | null;
  logo_width?: number | null;
  logo_fit?: string | null;
  logo_radius?: number | null;
  logo_rotation?: number | null;
  logo_padding?: number | null;
  logo_bg_color?: string | null;
  logo_shadow?: boolean | null;
  logo_border?: boolean | null;
}

const Index = () => {
  const { t, dir, lang } = useLanguage();
  const { content, loading } = useSiteContent();
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobCount, setJobCount] = useState(0);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id,name_ar,name_en,description_ar,description_en,logo_url,is_active,logo_height,logo_width,logo_fit,logo_radius,logo_rotation,logo_padding,logo_bg_color,logo_shadow,logo_border")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("[projects] fetch error:", error);
          return;
        }
        if (data) setProjects(data as Project[]);
      });
    supabase.from("job_postings").select("id", { count: "exact", head: true }).eq("is_active", true).then(({ count }) => {
      setJobCount(count || 0);
    });
  }, []);

  const bi = (ar: string, en: string) => lang === "ar" ? ar : en;

  return (
    <div className="min-h-screen bg-background relative" dir={dir}>
      <AuroraBackground />
      {/* Navbar */}
      <nav className="absolute top-4 md:top-6 left-4 md:left-6 right-4 md:right-6 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-lg px-4 md:px-6 py-2.5">
          <div className={content.logo_alignment === "center" ? "absolute left-1/2 -translate-x-1/2" : ""}>
            <SiteLogo />
          </div>
          <div className="flex items-center gap-3 ms-auto">
            <TopBar variant="light" />
            <Link to="/jobs">
              <Button variant="ghost" className="text-primary-foreground hover:bg-white/10 gap-2 font-medium">
                <Search className="w-4 h-4" />
                <span className="hidden md:inline">{t("nav.jobs")}</span>
              </Button>
            </Link>
            <Link to="/training">
              <Button variant="ghost" className="text-primary-foreground hover:bg-white/10 gap-2 font-medium hidden md:inline-flex">
                {t("nav.training")}
              </Button>
            </Link>
            <Link to="/apply">
              <Button className="gradient-accent text-accent-foreground hover:opacity-90 gap-2 font-semibold">
                {t("nav.apply")}
                <Arrow className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden" style={content.hero_bg_color ? { background: content.hero_bg_color } : undefined}>
        <div className="absolute inset-0">
          <img src={content.hero_image_url || heroBg} alt="" className="w-full h-full object-cover" width={1920} height={1080} />
          {!content.hero_bg_color && <div className="absolute inset-0 gradient-hero opacity-85" />}
          {!content.hero_bg_color && <div className="absolute inset-0 bg-grid-dots opacity-40" />}
          {!content.hero_bg_color && <AINetworkBackground />}
        </div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-2xl space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm text-sm font-semibold text-primary-foreground animate-scale-in">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              <span className="text-gradient">{bi("مدعوم بالذكاء الاصطناعي", "AI-Powered Recruitment")}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-primary-foreground leading-tight">
              {bi(content.hero_title1_ar, content.hero_title1_en)}
              <br />
              <span className="text-gradient">{bi(content.hero_title2_ar, content.hero_title2_en)}</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed max-w-lg">
              {bi(content.hero_desc_ar, content.hero_desc_en)}
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/apply">
                <Button size="lg" className="gradient-accent text-accent-foreground hover:opacity-90 gap-2 text-lg px-8 py-6 font-bold shadow-glow animate-glow-pulse">
                  {t("hero.cta")}
                  <Arrow className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/jobs">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 gap-2 text-lg px-8 py-6 font-bold border-2 border-white">
                  <Search className="w-5 h-5" />
                  {t("hero.viewJobs")}
                  {jobCount > 0 && (
                    <span className="bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-full">{jobCount}</span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {content.show_stats_section && (
        <section className="py-12 px-6 bg-card border-b border-border" style={content.stats_bg_color ? { background: content.stats_bg_color } : undefined}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-10">
              {bi(content.stats_section_title_ar, content.stats_section_title_en)}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Users, value: `+${content.employee_count}`, label: bi("موظف", "Employees") },
                { icon: Calendar, value: content.founding_year, label: bi("سنة التأسيس", "Founded") },
                { icon: FolderOpen, value: `+${content.projects_count}`, label: bi("مشروع", "Projects") },
                { icon: Briefcase, value: `${jobCount}`, label: bi("وظيفة شاغرة", "Open Positions") },
              ].map((stat, i) => (
                <div key={i} className="text-center space-y-2 rounded-xl p-4 glass-panel hover-lift hover:shadow-glow animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="w-14 h-14 rounded-xl gradient-accent flex items-center justify-center mx-auto shadow-glow animate-float" style={{ animationDelay: `${i * 0.3}s` }}>
                    <stat.icon className="w-7 h-7 text-accent-foreground" />
                  </div>
                  <p className="text-3xl md:text-4xl font-black text-primary">{stat.value}</p>
                  <p className="text-muted-foreground font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Projects Showcase */}
      {content.show_projects_section && projects.length > 0 && (
        <section className="py-16 px-6 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-4">
              {bi("مشاريعنا", "Our Projects")}
            </h2>
            <p className="text-muted-foreground text-center mb-10 text-lg max-w-xl mx-auto">
              {bi("نعمل على مشاريع رائدة في مختلف القطاعات", "We work on leading projects across various sectors")}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {projects.map((project, i) => (
                <div key={project.id} className="group animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="bg-card rounded-xl border border-border p-6 hover-lift hover:shadow-elevated text-center h-full flex flex-col items-center justify-center gap-4">
                    <ProjectLogo
                      path={project.logo_url}
                      alt={bi(project.name_ar, project.name_en || project.name_ar)}
                      height={project.logo_height ?? 64}
                      width={project.logo_width}
                      fit={project.logo_fit}
                      radius={project.logo_radius}
                      rotation={project.logo_rotation}
                      padding={project.logo_padding}
                      bgColor={project.logo_bg_color}
                      shadow={project.logo_shadow}
                      border={project.logo_border}
                    />
                    <div>
                      <h3 className="font-bold text-foreground group-hover:text-accent transition-colors">
                        {bi(project.name_ar, project.name_en || project.name_ar)}
                      </h3>
                      {(project.description_ar || project.description_en) && (
                        <p className="text-muted-foreground text-xs mt-1 line-clamp-2">
                          {bi(project.description_ar || "", project.description_en || project.description_ar || "")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-20 px-6" style={content.features_bg_color ? { background: content.features_bg_color } : undefined}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-primary text-center mb-4">
            {bi("لماذا " + content.site_name_ar + "؟", "Why " + content.site_name_en + "?")}
          </h2>
          <p className="text-muted-foreground text-center mb-14 text-lg max-w-xl mx-auto">
            {bi("نقدم بيئة عمل محفزة وفرص نمو حقيقية لكل فرد في فريقنا", "We offer a stimulating environment and real growth opportunities")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Building2, title: bi(content.feature1_title_ar, content.feature1_title_en), desc: bi(content.feature1_desc_ar, content.feature1_desc_en) },
              { icon: Users, title: bi(content.feature2_title_ar, content.feature2_title_en), desc: bi(content.feature2_desc_ar, content.feature2_desc_en) },
              { icon: TrendingUp, title: bi(content.feature3_title_ar, content.feature3_title_en), desc: bi(content.feature3_desc_ar, content.feature3_desc_en) },
            ].map((feature, i) => (
              <div key={i} className="glass-panel rounded-xl p-8 shadow-card hover-lift hover:shadow-glow text-center animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-14 h-14 rounded-xl gradient-accent flex items-center justify-center mx-auto mb-5 shadow-glow">
                  <feature.icon className="w-7 h-7 text-accent-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-hero py-16 px-6" style={content.cta_bg_color ? { background: content.cta_bg_color } : undefined}>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">
            {bi(content.cta_title_ar, content.cta_title_en)}
          </h2>
          <p className="text-primary-foreground/70 text-lg">
            {bi(content.cta_desc_ar, content.cta_desc_en)}
          </p>
          <Link to="/apply">
            <Button size="lg" className="gradient-accent text-accent-foreground hover:opacity-90 gap-2 text-lg px-10 py-6 font-bold shadow-glow animate-glow-pulse mt-4">
              {t("cta.button")}
              <Arrow className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card py-8 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SiteLogo heightOverride={32} />
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {bi(content.site_name_ar, content.site_name_en)} — {bi("جميع الحقوق محفوظة", "All Rights Reserved")}
          </p>
          <Link to="/track" className="text-sm text-primary hover:underline font-medium">
            {t("nav.track")}
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Index;
