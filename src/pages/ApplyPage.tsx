import { useSearchParams, Link, useNavigate } from "react-router-dom";
import ApplicationForm from "@/components/ApplicationForm/ApplicationForm";
import TopBar from "@/components/TopBar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteContent } from "@/hooks/useSiteContent";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import SiteLogo from "@/components/SiteLogo";
import AuroraBackground from "@/components/AuroraBackground";

const ApplyPage = () => {
  const { t, dir, lang } = useLanguage();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedPosition = searchParams.get("position") || "";
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  const applyTitle = lang === "ar" ? content.apply_title_ar : content.apply_title_en;
  const applyDesc = lang === "ar" ? content.apply_desc_ar : content.apply_desc_en;

  return (
    <div className="min-h-screen bg-background relative" dir={dir}>
      <AuroraBackground />
      {/* Header */}
      <header className="gradient-hero py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/10">
              <BackArrow className="w-5 h-5" />
            </Button>
            <Link to="/"><SiteLogo className="h-12" /></Link>
          </div>
          <div className="flex items-center gap-3">
            <TopBar variant="light" />
            <span className="text-primary-foreground/80 text-sm font-medium hidden md:inline">{t("nav.formTitle")}</span>
          </div>
        </div>
      </header>

      {/* Form Section */}
      <main className="py-10 px-4">
        <div className="max-w-3xl mx-auto mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">{applyTitle}</h1>
          <p className="text-muted-foreground text-lg">{applyDesc}</p>
        </div>
        <ApplicationForm preSelectedPosition={preSelectedPosition} />
      </main>

      {/* Footer */}
      <footer className="gradient-hero py-6 px-4 mt-10">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-primary-foreground/60 text-sm">
            © {new Date().getFullYear()} {t("footer.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ApplyPage;
