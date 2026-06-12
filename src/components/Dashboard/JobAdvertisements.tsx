import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Printer, Save, Trash2, FileEdit, Plus, Briefcase, MapPin, Users, Sparkles, Eye,
  Upload, X, Wand2, ImageIcon, Palette, QrCode, LayoutGrid, Download, Type,
} from "lucide-react";
import { toPng, toJpeg } from "html-to-image";
import BrandMark from "@/components/BrandMark";

interface JobPosting {
  id: string;
  title_ar: string;
  title_en: string | null;
  location: string;
  location_en: string | null;
  job_type: string;
  job_type_en: string | null;
  department: string | null;
  department_en: string | null;
  vacancy_count: number;
  nationality_required: string | null;
  experience_required_ar: string | null;
  degree_required_ar: string | null;
  is_active: boolean;
}

interface ManualJob {
  id: string;
  title_ar: string;
  title_en: string;
  category?: string;
  location?: string;
  vacancy_count?: number;
}

interface Advertisement {
  id: string;
  title_ar: string;
  title_en: string | null;
  subtitle_ar: string | null;
  subtitle_en: string | null;
  job_ids: string[];
  manual_jobs: ManualJob[];
  design_style: string;
  layout_type: string;
  accent_color: string | null;
  secondary_color: string | null;
  text_color: string | null;
  logo_url: string | null;
  background_url: string | null;
  show_qr: boolean;
  qr_url: string | null;
  notes: string | null;
  created_at: string;
  created_by_email: string | null;
}

const DESIGN_STYLES = [
  { value: "alkholi-official", label_ar: "القالب المميز", label_en: "Premium Template" },
  { value: "modern", label_ar: "عصري", label_en: "Modern" },
  { value: "elegant", label_ar: "أنيق كلاسيكي", label_en: "Elegant" },
  { value: "bold", label_ar: "قوي وجريء", label_en: "Bold" },
  { value: "minimal", label_ar: "بسيط نظيف", label_en: "Minimal" },
  { value: "luxury", label_ar: "فاخر ذهبي", label_en: "Luxury Gold" },
  { value: "corporate", label_ar: "كوربوريت", label_en: "Corporate" },
  { value: "creative", label_ar: "إبداعي", label_en: "Creative" },
  { value: "geometric", label_ar: "هندسي", label_en: "Geometric" },
  { value: "gradient", label_ar: "متدرج عصري", label_en: "Gradient" },
  { value: "magazine", label_ar: "أسلوب مجلة", label_en: "Magazine" },
];

const LAYOUT_TYPES = [
  { value: "grid", label_ar: "شبكة مربعات", label_en: "Grid", icon: "▦" },
  { value: "cascade", label_ar: "شلال متدرج", label_en: "Cascade", icon: "⫸" },
  { value: "masonry", label_ar: "بطاقات متنوعة", label_en: "Masonry", icon: "▤" },
  { value: "list", label_ar: "قائمة أنيقة", label_en: "Elegant List", icon: "☰" },
  { value: "two-col", label_ar: "عمودين متوازيين", label_en: "Two Columns", icon: "‖" },
  { value: "hexagon", label_ar: "خلية النحل", label_en: "Honeycomb", icon: "⬡" },
  { value: "timeline", label_ar: "خط زمني", label_en: "Timeline", icon: "⊢" },
  { value: "tags", label_ar: "بطاقات وسوم", label_en: "Tag Pills", icon: "◉" },
  { value: "compact", label_ar: "مدمج كثيف", label_en: "Compact Dense", icon: "▢" },
  { value: "numbered", label_ar: "أرقام كبيرة", label_en: "Big Numbers", icon: "①" },
];

const BILINGUAL_OPTIONS = [
  { value: "ar", label_ar: "عربي فقط", label_en: "Arabic only" },
  { value: "en", label_ar: "إنجليزي فقط", label_en: "English only" },
  { value: "both", label_ar: "ثنائي (عربي + إنجليزي)", label_en: "Bilingual (AR + EN)" },
];

const DEFAULT_LOGO_FALLBACK = "/placeholder.svg";

const FONT_STACKS: Record<string, string> = {
  system: "system-ui, 'Segoe UI', Tahoma, sans-serif",
  tajawal: "'Tajawal', system-ui, sans-serif",
  cairo: "'Cairo', system-ui, sans-serif",
  almarai: "'Almarai', system-ui, sans-serif",
  "ibm-plex": "'IBM Plex Sans Arabic', system-ui, sans-serif",
  readex: "'Readex Pro', system-ui, sans-serif",
  "noto-kufi": "'Noto Kufi Arabic', system-ui, sans-serif",
};
const getFontStack = (key: string) => FONT_STACKS[key] || FONT_STACKS.system;

const JobAdvertisements = () => {
  const { lang, dir } = useLanguage();
  const ar = lang === "ar";
  const printRef = useRef<HTMLDivElement>(null);

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleAr, setTitleAr] = useState("فرص وظيفية مميزة");
  const [titleEn, setTitleEn] = useState("Exciting Job Opportunities");
  const [subtitleAr, setSubtitleAr] = useState("انضم إلى فريق منصة التوظيف الذكية");
  const [subtitleEn, setSubtitleEn] = useState("Join the NexHire AI Team");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [manualJobs, setManualJobs] = useState<ManualJob[]>([]);
  const [designStyle, setDesignStyle] = useState("modern");
  const [layoutType, setLayoutType] = useState("grid");
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [secondaryColor, setSecondaryColor] = useState("#22d3ee");
  const [textColor, setTextColor] = useState("#ffffff");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [removingBgMode, setRemovingBgMode] = useState<null | "transparent" | "white-png" | "white-jpg">(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(true);
  const [qrUrl, setQrUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [bilingualMode, setBilingualMode] = useState<"ar" | "en" | "both">("both");
  const [showVacancyPerJob, setShowVacancyPerJob] = useState(false);
  const [totalVacancies, setTotalVacancies] = useState<number | "">("");
  const [showTotalVacancies, setShowTotalVacancies] = useState(true);

  // ====== Premium template fine controls ======
  const [akHeaderHeight, setAkHeaderHeight] = useState(150);
  const [akHeaderChevronPos, setAkHeaderChevronPos] = useState(45); // % left start of white wedge
  const [akShowFooterChevron, setAkShowFooterChevron] = useState(true);
  const [akFooterHeight, setAkFooterHeight] = useState(60);
  const [akFooterChevronPos, setAkFooterChevronPos] = useState(50); // % center peak
  const [akBodyFontSize, setAkBodyFontSize] = useState<number | null>(null); // null = auto
  const [akTitleFontSize, setAkTitleFontSize] = useState(32);
  const [akPagePaddingX, setAkPagePaddingX] = useState(40);
  const [akPagePaddingTop, setAkPagePaddingTop] = useState(10);
  const [akPagePaddingBottom, setAkPagePaddingBottom] = useState(70);
  const [akPageHeightMm, setAkPageHeightMm] = useState(297);
  const [akPageWidthMm, setAkPageWidthMm] = useState(210);
  const [akSinglePage, setAkSinglePage] = useState(true);
  const [showPreview, setShowPreview] = useState(true);

  // ====== Campaign location (announced city) ======
  const [campaignLocationAr, setCampaignLocationAr] = useState("");
  const [campaignLocationEn, setCampaignLocationEn] = useState("");
  const [showCampaignLocation, setShowCampaignLocation] = useState(true);

  // ====== Custom header image (replaces chevron when set) ======
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [uploadingHeaderImg, setUploadingHeaderImg] = useState(false);
  const [headerImgFit, setHeaderImgFit] = useState<"cover" | "contain" | "fill">("cover");
  const [headerImgOpacity, setHeaderImgOpacity] = useState(100);
  const [headerImgPosY, setHeaderImgPosY] = useState(50);
  const [hideHeaderChevron, setHideHeaderChevron] = useState(false);

  // ====== Custom footer image (replaces footer chevron when set) ======
  const [footerImageUrl, setFooterImageUrl] = useState<string | null>(null);
  const [uploadingFooterImg, setUploadingFooterImg] = useState(false);
  const [footerImgFit, setFooterImgFit] = useState<"cover" | "contain" | "fill">("cover");
  const [footerImgOpacity, setFooterImgOpacity] = useState(100);
  const [footerImgPosY, setFooterImgPosY] = useState(50);
  const [hideFooterChevron, setHideFooterChevron] = useState(false);

  // ====== Logo style controls ======
  const [logoTransparentBg, setLogoTransparentBg] = useState(false);
  const [logoSize, setLogoSize] = useState(60);
  const [logoPadding, setLogoPadding] = useState(0);
  const [logoRadius, setLogoRadius] = useState(0);
  const [logoOffsetX, setLogoOffsetX] = useState(0);
  const [logoOffsetY, setLogoOffsetY] = useState(0);
  const [logoAlign, setLogoAlign] = useState<"start" | "center" | "end">("start");
  const [logoBgColor, setLogoBgColor] = useState<string>("#ffffff");
  const [logoUseCustomBg, setLogoUseCustomBg] = useState(false);

  // ====== Font family ======
  const [fontFamily, setFontFamily] = useState<string>("system");

  // ====== Title alignment & spacing (Premium template) ======
  const [titleAlignAr, setTitleAlignAr] = useState<"start" | "center" | "end">("end");
  const [titleAlignEn, setTitleAlignEn] = useState<"start" | "center" | "end">("start");
  const [titleOffsetX, setTitleOffsetX] = useState(0);
  const [titleOffsetY, setTitleOffsetY] = useState(0);

  // AI helper state
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Manual job entry
  const [newJobAr, setNewJobAr] = useState("");
  const [newJobEn, setNewJobEn] = useState("");
  const [newJobLocation, setNewJobLocation] = useState("");
  

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    // Default QR url to the project's apply page
    if (!qrUrl) {
      setQrUrl(`${window.location.origin}/jobs`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [jobsRes, adsRes] = await Promise.all([
      supabase.from("job_postings").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("job_advertisements").select("*").order("created_at", { ascending: false }),
    ]);
    if (jobsRes.data) setJobs(jobsRes.data as any);
    if (adsRes.data) setAds(adsRes.data as any);
    setLoading(false);
  };

  const resetEditor = () => {
    setEditingId(null);
    setTitleAr("فرص وظيفية مميزة");
    setTitleEn("Exciting Job Opportunities");
    setSubtitleAr("انضم إلى فريق منصة التوظيف الذكية");
    setSubtitleEn("Join the NexHire AI Team");
    setSelectedJobs([]);
    setManualJobs([]);
    setDesignStyle("modern");
    setLayoutType("grid");
    setAccentColor("#3b82f6");
    setSecondaryColor("#22d3ee");
    setTextColor("#ffffff");
    setLogoUrl(null);
    setBackgroundUrl(null);
    setShowQr(true);
    setQrUrl(`${window.location.origin}/jobs`);
    setNotes("");
    setBilingualMode("both");
    setShowVacancyPerJob(false);
    setShowTotalVacancies(true);
    setTotalVacancies("");
    setLogoTransparentBg(false);
    setLogoSize(60);
    setLogoPadding(0);
    setLogoRadius(0);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
    setLogoAlign("start");
    setLogoBgColor("#ffffff");
    setLogoUseCustomBg(false);
    setFontFamily("system");
    setTitleAlignAr("end");
    setTitleAlignEn("start");
    setTitleOffsetX(0);
    setTitleOffsetY(0);
  };

  const loadAd = (ad: Advertisement) => {
    setEditingId(ad.id);
    setTitleAr(ad.title_ar);
    setTitleEn(ad.title_en || "");
    setSubtitleAr(ad.subtitle_ar || "");
    setSubtitleEn(ad.subtitle_en || "");
    setSelectedJobs(ad.job_ids || []);
    setManualJobs(Array.isArray(ad.manual_jobs) ? ad.manual_jobs : []);
    setDesignStyle(ad.design_style);
    setLayoutType(ad.layout_type || "grid");
    setAccentColor(ad.accent_color || "#3b82f6");
    setSecondaryColor(ad.secondary_color || "#22d3ee");
    setTextColor(ad.text_color || "#ffffff");
    setLogoUrl(ad.logo_url);
    setBackgroundUrl(ad.background_url);
    setShowQr(ad.show_qr ?? true);
    setQrUrl(ad.qr_url || `${window.location.origin}/jobs`);
    setNotes(ad.notes || "");
    const meta = (ad as any).ai_metadata || {};
    setBilingualMode(meta.bilingual_mode || "both");
    setShowVacancyPerJob(!!meta.show_vacancy_per_job);
    setShowTotalVacancies(meta.show_total_vacancies !== false);
    setTotalVacancies(meta.total_vacancies ?? "");
    // Premium tuning
    if (meta.ak_header_height != null) setAkHeaderHeight(meta.ak_header_height);
    if (meta.ak_header_chevron_pos != null) setAkHeaderChevronPos(meta.ak_header_chevron_pos);
    if (meta.ak_show_footer_chevron != null) setAkShowFooterChevron(meta.ak_show_footer_chevron);
    if (meta.ak_footer_height != null) setAkFooterHeight(meta.ak_footer_height);
    if (meta.ak_footer_chevron_pos != null) setAkFooterChevronPos(meta.ak_footer_chevron_pos);
    setAkBodyFontSize(meta.ak_body_font_size ?? null);
    if (meta.ak_title_font_size != null) setAkTitleFontSize(meta.ak_title_font_size);
    if (meta.ak_page_padding_x != null) setAkPagePaddingX(meta.ak_page_padding_x);
    if (meta.ak_page_padding_top != null) setAkPagePaddingTop(meta.ak_page_padding_top);
    if (meta.ak_page_padding_bottom != null) setAkPagePaddingBottom(meta.ak_page_padding_bottom);
    if (meta.ak_page_height_mm != null) setAkPageHeightMm(meta.ak_page_height_mm);
    if (meta.ak_page_width_mm != null) setAkPageWidthMm(meta.ak_page_width_mm);
    if (meta.ak_single_page != null) setAkSinglePage(meta.ak_single_page);
    // Campaign location
    setCampaignLocationAr(meta.campaign_location_ar || "");
    setCampaignLocationEn(meta.campaign_location_en || "");
    setShowCampaignLocation(meta.show_campaign_location !== false);
    // Header image
    setHeaderImageUrl(meta.header_image_url || null);
    setHeaderImgFit(meta.header_img_fit || "cover");
    setHeaderImgOpacity(meta.header_img_opacity ?? 100);
    setHeaderImgPosY(meta.header_img_pos_y ?? 50);
    setHideHeaderChevron(!!meta.hide_header_chevron);
    // Footer image
    setFooterImageUrl(meta.footer_image_url || null);
    setFooterImgFit(meta.footer_img_fit || "cover");
    setFooterImgOpacity(meta.footer_img_opacity ?? 100);
    setFooterImgPosY(meta.footer_img_pos_y ?? 50);
    setHideFooterChevron(!!meta.hide_footer_chevron);
    // Logo style
    setLogoTransparentBg(!!meta.logo_transparent_bg);
    setLogoSize(meta.logo_size ?? 60);
    setLogoPadding(meta.logo_padding ?? 0);
    setLogoRadius(meta.logo_radius ?? 0);
    setLogoOffsetX(meta.logo_offset_x ?? 0);
    setLogoOffsetY(meta.logo_offset_y ?? 0);
    setLogoAlign(meta.logo_align || "start");
    setLogoBgColor(meta.logo_bg_color || "#ffffff");
    setLogoUseCustomBg(!!meta.logo_use_custom_bg);
    // Font
    setFontFamily(meta.font_family || "system");
    // Title alignment
    setTitleAlignAr(meta.title_align_ar || "end");
    setTitleAlignEn(meta.title_align_en || "start");
    setTitleOffsetX(meta.title_offset_x ?? 0);
    setTitleOffsetY(meta.title_offset_y ?? 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadAsset = async (file: File, kind: "logo" | "background" | "header" | "footer") => {
    const setUploading =
      kind === "logo" ? setUploadingLogo
      : kind === "background" ? setUploadingBg
      : kind === "header" ? setUploadingHeaderImg
      : setUploadingFooterImg;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${kind}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("ad-assets").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("ad-assets").getPublicUrl(path);
      if (kind === "logo") setLogoUrl(data.publicUrl);
      else if (kind === "background") setBackgroundUrl(data.publicUrl);
      else if (kind === "header") setHeaderImageUrl(data.publicUrl);
      else setFooterImageUrl(data.publicUrl);
      toast.success(ar ? "تم رفع الصورة" : "Image uploaded");
    } catch (e: any) {
      toast.error(e.message || (ar ? "فشل الرفع" : "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!titleAr.trim()) { toast.error(ar ? "العنوان مطلوب" : "Title is required"); return; }
    if (selectedJobs.length === 0 && manualJobs.length === 0) {
      toast.error(ar ? "أضف وظيفة واحدة على الأقل (من النظام أو يدويًا)" : "Add at least one job (system or manual)");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title_ar: titleAr,
      title_en: titleEn || null,
      subtitle_ar: subtitleAr || null,
      subtitle_en: subtitleEn || null,
      job_ids: selectedJobs,
      manual_jobs: manualJobs as any,
      design_style: designStyle,
      layout_type: layoutType,
      accent_color: accentColor,
      secondary_color: secondaryColor,
      text_color: textColor,
      logo_url: logoUrl,
      background_url: backgroundUrl,
      show_qr: showQr,
      qr_url: qrUrl || null,
      notes: notes || null,
      created_by: user?.id,
      created_by_email: user?.email,
      ai_metadata: {
        bilingual_mode: bilingualMode,
        show_vacancy_per_job: showVacancyPerJob,
        show_total_vacancies: showTotalVacancies,
        total_vacancies: totalVacancies === "" ? null : Number(totalVacancies),
        // Premium tuning
        ak_header_height: akHeaderHeight,
        ak_header_chevron_pos: akHeaderChevronPos,
        ak_show_footer_chevron: akShowFooterChevron,
        ak_footer_height: akFooterHeight,
        ak_footer_chevron_pos: akFooterChevronPos,
        ak_body_font_size: akBodyFontSize,
        ak_title_font_size: akTitleFontSize,
        ak_page_padding_x: akPagePaddingX,
        ak_page_padding_top: akPagePaddingTop,
        ak_page_padding_bottom: akPagePaddingBottom,
        ak_page_height_mm: akPageHeightMm,
        ak_page_width_mm: akPageWidthMm,
        ak_single_page: akSinglePage,
        // Campaign location
        campaign_location_ar: campaignLocationAr,
        campaign_location_en: campaignLocationEn,
        show_campaign_location: showCampaignLocation,
        // Header image
        header_image_url: headerImageUrl,
        header_img_fit: headerImgFit,
        header_img_opacity: headerImgOpacity,
        header_img_pos_y: headerImgPosY,
        hide_header_chevron: hideHeaderChevron,
        // Footer image
        footer_image_url: footerImageUrl,
        footer_img_fit: footerImgFit,
        footer_img_opacity: footerImgOpacity,
        footer_img_pos_y: footerImgPosY,
        hide_footer_chevron: hideFooterChevron,
        // Logo style
        logo_transparent_bg: logoTransparentBg,
        logo_size: logoSize,
        logo_padding: logoPadding,
        logo_radius: logoRadius,
        logo_offset_x: logoOffsetX,
        logo_offset_y: logoOffsetY,
        logo_align: logoAlign,
        logo_bg_color: logoBgColor,
        logo_use_custom_bg: logoUseCustomBg,
        // Font
        font_family: fontFamily,
        // Title alignment
        title_align_ar: titleAlignAr,
        title_align_en: titleAlignEn,
        title_offset_x: titleOffsetX,
        title_offset_y: titleOffsetY,
      } as any,
    };

    if (editingId) {
      const { error } = await supabase.from("job_advertisements").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success(ar ? "تم تحديث الإعلان" : "Advertisement updated");
    } else {
      const { error } = await supabase.from("job_advertisements").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(ar ? "تم حفظ الإعلان" : "Advertisement saved");
    }
    resetEditor();
    loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? "هل تريد حذف هذا الإعلان؟" : "Delete this advertisement?")) return;
    const { error } = await supabase.from("job_advertisements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(ar ? "تم الحذف" : "Deleted");
    if (editingId === id) resetEditor();
    loadAll();
  };

  const handlePrint = () => window.print();

  const [downloading, setDownloading] = useState(false);
  const [previewImg, setPreviewImg] = useState<{ url: string; format: "png" | "jpeg"; scale: number; sizeKb: number } | null>(null);

  const generateImage = async (format: "png" | "jpeg", scale: number): Promise<string> => {
    if (!printRef.current) throw new Error("no preview");
    if (!showPreview) {
      setShowPreview(true);
      await new Promise(r => setTimeout(r, 500));
    }
    const node = printRef.current;
    // Capture the FULL size (including overflow) — not just the visible viewport
    const fullWidth = Math.max(node.scrollWidth, node.offsetWidth, node.clientWidth);
    const fullHeight = Math.max(node.scrollHeight, node.offsetHeight, node.clientHeight);
    // Wait for any images inside to finish loading
    const imgs = Array.from(node.querySelectorAll("img"));
    await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => {
      img.onload = img.onerror = () => res(null);
    })));
    const opts = {
      cacheBust: true,
      pixelRatio: scale,
      backgroundColor: "#ffffff",
      skipFonts: false,
      width: fullWidth,
      height: fullHeight,
      canvasWidth: fullWidth * scale,
      canvasHeight: fullHeight * scale,
      style: {
        transform: "none",
        transformOrigin: "top left",
        margin: "0",
        width: `${fullWidth}px`,
        height: `${fullHeight}px`,
      },
    };
    return format === "jpeg"
      ? await toJpeg(node, { ...opts, quality: 0.98 })
      : await toPng(node, opts);
  };

  const handlePreviewExport = async (format: "png" | "jpeg", scale: number) => {
    setDownloading(true);
    try {
      const dataUrl = await generateImage(format, scale);
      const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
      setPreviewImg({ url: dataUrl, format, scale, sizeKb });
    } catch (e: any) {
      toast.error((ar ? "فشل التوليد: " : "Generation failed: ") + (e?.message || "error"));
    } finally {
      setDownloading(false);
    }
  };

  const confirmDownload = () => {
    if (!previewImg) return;
    const link = document.createElement("a");
    const safeTitle = (titleAr || titleEn || "advertisement").replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60);
    link.download = `${safeTitle}_${new Date().toISOString().slice(0,10)}.${previewImg.format}`;
    link.href = previewImg.url;
    link.click();
    toast.success(ar ? "تم تحميل الصورة" : "Image downloaded");
    setPreviewImg(null);
  };

  const toggleJob = (id: string) => {
    setSelectedJobs(prev => prev.includes(id) ? prev.filter(j => j !== id) : [...prev, id]);
  };

  const addManualJob = () => {
    if (!newJobAr.trim() && !newJobEn.trim()) {
      toast.error(ar ? "أدخل المسمى الوظيفي" : "Enter job title");
      return;
    }
    setManualJobs(prev => [...prev, {
      id: crypto.randomUUID(),
      title_ar: newJobAr || newJobEn,
      title_en: newJobEn || newJobAr,
      location: newJobLocation || undefined,
    }]);
    setNewJobAr(""); setNewJobEn(""); setNewJobLocation("");
  };

  const removeManualJob = (id: string) => setManualJobs(prev => prev.filter(j => j.id !== id));

  const runAiAnalysis = async () => {
    const titles = aiInput.split(/[\n,،]/).map(s => s.trim()).filter(Boolean);
    if (titles.length === 0) {
      toast.error(ar ? "ألصق قائمة مسميات وظيفية أولاً" : "Paste job titles first");
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-job-titles", {
        body: { titles },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newOnes: ManualJob[] = (data.jobs || []).map((j: any) => ({
        id: crypto.randomUUID(),
        title_ar: j.title_ar,
        title_en: j.title_en,
        category: j.category,
        vacancy_count: 1,
      }));
      setManualJobs(prev => [...prev, ...newOnes]);
      setAiInput("");
      toast.success(ar ? `تمت إضافة ${newOnes.length} وظيفة بعد التحليل` : `Added ${newOnes.length} jobs after analysis`);
    } catch (e: any) {
      toast.error(e.message || (ar ? "فشل التحليل" : "Analysis failed"));
    } finally {
      setAiLoading(false);
    }
  };

  const selectedJobObjects = jobs.filter(j => selectedJobs.includes(j.id));
  // Combine system + manual into render-friendly shape
  const allRenderJobs = [
    ...selectedJobObjects.map(j => ({
      id: j.id,
      title_ar: j.title_ar,
      title_en: j.title_en || j.title_ar,
      location: j.location,
      location_en: j.location_en,
      job_type: j.job_type,
      job_type_en: j.job_type_en,
      department: j.department,
      department_en: j.department_en,
      vacancy_count: j.vacancy_count,
      nationality_required: j.nationality_required,
      isManual: false,
    })),
    ...manualJobs.map(m => ({
      id: m.id,
      title_ar: m.title_ar,
      title_en: m.title_en,
      location: m.location || "",
      location_en: m.location || null,
      job_type: m.category || "",
      job_type_en: m.category || null,
      department: null,
      department_en: null,
      vacancy_count: m.vacancy_count || 1,
      nationality_required: null,
      isManual: true,
    })),
  ];

  return (
    <div className="space-y-6" dir={dir}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ad-print-area, #ad-print-area * { visibility: visible; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          #ad-print-area img { display: block !important; visibility: visible !important; }
          #ad-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          #ad-print-area .ak-page { page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; overflow: hidden !important; }
          .no-print { display: none !important; }
          @page { size: ${akPageWidthMm}mm ${akPageHeightMm}mm; margin: 0; }
        }
      `}</style>

      {/* Editor Card */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {editingId ? (ar ? "تعديل إعلان" : "Edit Advertisement") : (ar ? "إنشاء إعلان جديد" : "Create New Advertisement")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="content" className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="content" className="gap-1"><FileEdit className="w-4 h-4" />{ar ? "المحتوى" : "Content"}</TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1"><Briefcase className="w-4 h-4" />{ar ? "الوظائف" : "Jobs"}</TabsTrigger>
              <TabsTrigger value="ai" className="gap-1"><Wand2 className="w-4 h-4" />{ar ? "ذكاء اصطناعي" : "AI"}</TabsTrigger>
              <TabsTrigger value="design" className="gap-1"><Palette className="w-4 h-4" />{ar ? "التصميم" : "Design"}</TabsTrigger>
              <TabsTrigger value="branding" className="gap-1"><ImageIcon className="w-4 h-4" />{ar ? "الشعار والخلفية" : "Branding"}</TabsTrigger>
              <TabsTrigger value="qr" className="gap-1"><QrCode className="w-4 h-4" />QR</TabsTrigger>
              <TabsTrigger value="style" className="gap-1"><Type className="w-4 h-4" />{ar ? "خطوط ومحاذاة" : "Fonts & Layout"}</TabsTrigger>
              <TabsTrigger value="alkholi" className="gap-1"><Sparkles className="w-4 h-4" />{ar ? "ضبط القالب المميز" : "Premium Tuning"}</TabsTrigger>
            </TabsList>

            {/* CONTENT */}
            <TabsContent value="content" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{ar ? "العنوان الرئيسي (عربي)" : "Main Title (Arabic)"}</Label>
                  <Input value={titleAr} onChange={e => setTitleAr(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{ar ? "العنوان الرئيسي (إنجليزي)" : "Main Title (English)"}</Label>
                  <Input value={titleEn} onChange={e => setTitleEn(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>{ar ? "العنوان الفرعي (عربي)" : "Subtitle (Arabic)"}</Label>
                  <Input value={subtitleAr} onChange={e => setSubtitleAr(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{ar ? "العنوان الفرعي (إنجليزي)" : "Subtitle (English)"}</Label>
                  <Input value={subtitleEn} onChange={e => setSubtitleEn(e.target.value)} dir="ltr" />
                </div>
              </div>
              {/* Campaign Location (announced city) */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{ar ? "📍 موقع/مدينة الإعلان" : "📍 Announcement Location/City"}</Label>
                  <div className="flex items-center gap-2">
                    <Switch checked={showCampaignLocation} onCheckedChange={setShowCampaignLocation} id="show-camp-loc" />
                    <Label htmlFor="show-camp-loc" className="text-xs">{ar ? "إظهار في الإعلان" : "Show on ad"}</Label>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Input placeholder={ar ? "المدينة (عربي) — مثال: الرياض، جدة" : "City (Arabic)"} value={campaignLocationAr} onChange={e => setCampaignLocationAr(e.target.value)} />
                  <Input placeholder={ar ? "City (English) — e.g. Riyadh, Jeddah" : "City (English)"} value={campaignLocationEn} onChange={e => setCampaignLocationEn(e.target.value)} dir="ltr" />
                </div>
                <p className="text-[11px] text-muted-foreground">{ar ? "تظهر بشكل بارز في الهيدر، تنطبق على كل الوظائف في الإعلان." : "Displayed prominently in the header, applies to all jobs in this ad."}</p>
              </div>
              <div className="space-y-2">
                <Label>{ar ? "ملاحظات داخلية" : "Internal Notes"}</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
            </TabsContent>

            {/* JOBS */}
            <TabsContent value="jobs" className="space-y-4">
              {/* Manual job entry */}
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <Label className="text-sm font-semibold">{ar ? "إضافة وظيفة يدوية (لا ترتبط بالموقع)" : "Add manual job (not linked to site)"}</Label>
                <div className="grid md:grid-cols-4 gap-2">
                  <Input placeholder={ar ? "المسمى عربي" : "Title (AR)"} value={newJobAr} onChange={e => setNewJobAr(e.target.value)} />
                  <Input placeholder="Title (EN)" value={newJobEn} onChange={e => setNewJobEn(e.target.value)} dir="ltr" />
                  <Input placeholder={ar ? "الموقع (اختياري)" : "Location (optional)"} value={newJobLocation} onChange={e => setNewJobLocation(e.target.value)} />
                  <Button onClick={addManualJob} className="gap-1"><Plus className="w-4 h-4" />{ar ? "إضافة" : "Add"}</Button>
                </div>
                {manualJobs.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {manualJobs.map(m => (
                      <Badge key={m.id} variant="secondary" className="gap-1 pr-1">
                        <span>{ar ? m.title_ar : m.title_en}</span>
                        {m.location && <span className="text-[10px] opacity-70">📍{m.location}</span>}
                        {m.category && <span className="text-[10px] opacity-60">·{m.category}</span>}
                        <button onClick={() => removeManualJob(m.id)} className="ml-1 hover:bg-destructive/20 rounded p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* System jobs picker */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>{ar ? "وظائف من النظام" : "System jobs"}</span>
                  <Badge variant="secondary">{selectedJobs.length} {ar ? "محدد" : "selected"}</Badge>
                </Label>
                <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                  {loading ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">{ar ? "جار التحميل..." : "Loading..."}</div>
                  ) : jobs.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">{ar ? "لا توجد وظائف نشطة" : "No active jobs"}</div>
                  ) : jobs.map(job => (
                    <label key={job.id} className="flex items-start gap-3 p-3 hover:bg-muted/40 cursor-pointer">
                      <Checkbox checked={selectedJobs.includes(job.id)} onCheckedChange={() => toggleJob(job.id)} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{ar ? job.title_ar : (job.title_en || job.title_ar)}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{ar ? job.location : (job.location_en || job.location)}</span>
                          <span className="inline-flex items-center gap-1"><Briefcase className="w-3 h-3" />{ar ? job.job_type : (job.job_type_en || job.job_type)}</span>
                          <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{job.vacancy_count}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* AI */}
            <TabsContent value="ai" className="space-y-3">
              <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-accent/5 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Wand2 className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">{ar ? "تنظيف وتنظيم وظائف بالذكاء الاصطناعي" : "AI Job Cleanup & Organization"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {ar
                        ? "ألصق أي قائمة مسميات وظيفية مختلطة (عربي/إنجليزي/فوضى) — سأنظفها، أترجمها، أصنفها، وأضيفها كوظائف يدوية."
                        : "Paste any messy list of job titles (mixed AR/EN) — I'll clean, translate, categorize, and add them as manual jobs."}
                    </div>
                  </div>
                </div>
                <Textarea
                  rows={6}
                  placeholder={ar
                    ? "مثال:\nمحاسب\nAccountant Senior\nمدير مشاريع\nHR Coordinator\n..."
                    : "Example:\nAccountant\nSenior Accountant\nHR Coordinator\n..."}
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                />
                <Button onClick={runAiAnalysis} disabled={aiLoading} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? (ar ? "جار التحليل..." : "Analyzing...") : (ar ? "حلّل وأضف" : "Analyze & Add")}
                </Button>
              </div>
            </TabsContent>

            {/* DESIGN */}
            <TabsContent value="design" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{ar ? "نمط التصميم" : "Design Style"}</Label>
                  <Select value={designStyle} onValueChange={setDesignStyle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DESIGN_STYLES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{ar ? s.label_ar : s.label_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><LayoutGrid className="w-4 h-4" />{ar ? "شكل عرض الوظائف" : "Jobs Layout"}</Label>
                  <Select value={layoutType} onValueChange={setLayoutType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LAYOUT_TYPES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="inline-flex items-center gap-2"><span>{s.icon}</span>{ar ? s.label_ar : s.label_en}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{ar ? "اللون الرئيسي" : "Accent Color"}</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-16 h-10 p-1" />
                    <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{ar ? "اللون الثانوي" : "Secondary Color"}</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-16 h-10 p-1" />
                    <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{ar ? "لون النص في الهيدر" : "Header Text Color"}</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-16 h-10 p-1" />
                    <Input value={textColor} onChange={e => setTextColor(e.target.value)} dir="ltr" />
                  </div>
                </div>
              </div>

              {/* Bilingual + Vacancies controls */}
              <div className="grid md:grid-cols-2 gap-4 pt-3 border-t">
                <div className="space-y-2">
                  <Label>{ar ? "لغة عرض الإعلان" : "Ad Display Language"}</Label>
                  <Select value={bilingualMode} onValueChange={(v) => setBilingualMode(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BILINGUAL_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{ar ? o.label_ar : o.label_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {ar ? "اختر «ثنائي» لعرض كل وظيفة بالعربية والإنجليزية معاً." : "Choose 'Bilingual' to show each job in both AR & EN."}
                  </p>
                </div>
                <div className="space-y-3">
                  <Label>{ar ? "إعدادات الشواغر" : "Vacancies Settings"}</Label>
                  <div className="flex items-center gap-3">
                    <Switch checked={showVacancyPerJob} onCheckedChange={setShowVacancyPerJob} id="vac-each" />
                    <Label htmlFor="vac-each" className="text-xs font-normal">{ar ? "إظهار عدد لكل وظيفة" : "Show count per job"}</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={showTotalVacancies} onCheckedChange={setShowTotalVacancies} id="vac-total" />
                    <Label htmlFor="vac-total" className="text-xs font-normal">{ar ? "إظهار العدد الإجمالي للشواغر" : "Show total vacancies"}</Label>
                  </div>
                  {showTotalVacancies && (
                    <Input
                      type="number" min={0}
                      placeholder={ar ? "العدد الإجمالي (اختياري — اتركه فارغاً للحساب التلقائي)" : "Total count (optional — leave blank for auto)"}
                      value={totalVacancies}
                      onChange={e => setTotalVacancies(e.target.value === "" ? "" : parseInt(e.target.value) || 0)}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* BRANDING */}
            <TabsContent value="branding" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <AssetUpload
                    label={ar ? "شعار الإعلان" : "Ad Logo"}
                    url={logoUrl}
                    uploading={uploadingLogo}
                    onFile={(f) => uploadAsset(f, "logo")}
                    onClear={() => setLogoUrl(null)}
                    ar={ar}
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                    { mode: "transparent", labelAr: "شفاف PNG", labelEn: "Transparent PNG" },
                      { mode: "white-png", labelAr: "أبيض PNG", labelEn: "White PNG" },
                      { mode: "white-jpg", labelAr: "أبيض لتصدير JPG", labelEn: "White for JPG export" },
                    ] as const).map((option) => (
                      <Button
                        key={option.mode}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full gap-2"
                        disabled={!logoUrl || removingBgMode !== null}
                        onClick={async () => {
                          if (!logoUrl) return;
                          setRemovingBgMode(option.mode);
                          try {
                            const { data, error } = await supabase.functions.invoke("remove-logo-bg", {
                              body: { imageUrl: logoUrl, outputMode: option.mode },
                            });
                            if (error) throw error;
                            if (!data?.url) throw new Error("No URL returned");
                            setLogoUrl(data.url);
                            toast.success(ar ? "تم تجهيز الشعار بنجاح" : "Logo processed successfully");
                          } catch (e: any) {
                            toast.error(e?.message || (ar ? "فشلت معالجة الشعار" : "Failed to process logo"));
                          } finally {
                            setRemovingBgMode(null);
                          }
                        }}
                      >
                        <Wand2 className="w-4 h-4" />
                        {removingBgMode === option.mode
                          ? (ar ? "جاري المعالجة..." : "Processing...")
                          : (ar ? option.labelAr : option.labelEn)}
                      </Button>
                    ))}
                  </div>
                </div>
                <AssetUpload
                  label={ar ? "صورة الخلفية" : "Background Image"}
                  url={backgroundUrl}
                  uploading={uploadingBg}
                  onFile={(f) => uploadAsset(f, "background")}
                  onClear={() => setBackgroundUrl(null)}
                  ar={ar}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "💡 الخلفية تظهر في الهيدر بشفافية. الشعار يظهر في الأعلى. يمكنك الآن استخراج الشعار فقط بالذكاء الاصطناعي بثلاثة أوضاع: شفاف PNG، أبيض PNG، أو أبيض مناسب لتصدير JPG."
                  : "💡 Background appears as a header overlay. Logo appears at the top. You can now isolate the logo with AI in three modes: transparent PNG, white PNG, or white prepared for JPG export."}
              </p>
            </TabsContent>

            {/* QR */}
            <TabsContent value="qr" className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={showQr} onCheckedChange={setShowQr} id="show-qr" />
                <Label htmlFor="show-qr">{ar ? "إظهار باركود QR" : "Show QR Code"}</Label>
              </div>
              <div className="space-y-2">
                <Label>{ar ? "رابط الباركود (يفتح عند المسح)" : "QR Target URL"}</Label>
                <Input value={qrUrl} onChange={e => setQrUrl(e.target.value)} dir="ltr" placeholder="https://..." />
              </div>
              {showQr && qrUrl && (
                <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30 w-fit">
                  <QRCodeSVG value={qrUrl} size={100} />
                  <div className="text-xs text-muted-foreground">
                    {ar ? "هكذا سيظهر الباركود في الإعلان" : "QR preview"}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* FONTS & LAYOUT (logo, font, alignment) */}
            <TabsContent value="style" className="space-y-5">
              {/* Logo style */}
              <div className="space-y-3 border rounded-lg p-3">
                <div className="font-semibold text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4" />{ar ? "تنسيق الشعار" : "Logo Style"}</div>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  {ar ? "💡 لتغيير ملف الشعار نفسه، استخدم زر «رفع شعار» في تبويب الأصول. هذا الشعار يظهر في القالب الرسمي بدلاً من الشعار الافتراضي. كما يمكنك الآن معالجة الشعار بالذكاء الاصطناعي: شفاف PNG أو أبيض PNG أو أبيض JPG مع حذف كل ما ليس جزءاً من الشعار." : "💡 To change the logo file itself, use the upload button in the Assets tab."}
                </p>

                <div className="flex items-center gap-3">
                  <Switch checked={logoTransparentBg} onCheckedChange={setLogoTransparentBg} id="logo-transparent" />
                  <Label htmlFor="logo-transparent" className="text-xs">
                    {ar ? "إزالة خلفية الشعار البيضاء (شفاف)" : "Remove white background (transparent)"}
                  </Label>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `الحجم: ${logoSize}px` : `Size: ${logoSize}px`}</Label>
                    <Input type="range" min={30} max={140} value={logoSize} onChange={e => setLogoSize(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `الحشو الداخلي: ${logoPadding}px` : `Padding: ${logoPadding}px`}</Label>
                    <Input type="range" min={0} max={20} value={logoPadding} onChange={e => setLogoPadding(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `الزوايا: ${logoRadius}px` : `Corner radius: ${logoRadius}px`}</Label>
                    <Input type="range" min={0} max={30} value={logoRadius} onChange={e => setLogoRadius(parseInt(e.target.value))} />
                  </div>
                </div>

                {/* Position controls */}
                <div className="grid md:grid-cols-3 gap-3 pt-2 border-t">
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? "محاذاة الشعار" : "Logo align"}</Label>
                    <Select value={logoAlign} onValueChange={(v: any) => setLogoAlign(v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start">{ar ? "بداية" : "Start"}</SelectItem>
                        <SelectItem value="center">{ar ? "وسط" : "Center"}</SelectItem>
                        <SelectItem value="end">{ar ? "نهاية" : "End"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `إزاحة أفقية: ${logoOffsetX}px` : `Offset X: ${logoOffsetX}px`}</Label>
                    <Input type="range" min={-100} max={100} value={logoOffsetX} onChange={e => setLogoOffsetX(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `إزاحة عمودية: ${logoOffsetY}px` : `Offset Y: ${logoOffsetY}px`}</Label>
                    <Input type="range" min={-50} max={50} value={logoOffsetY} onChange={e => setLogoOffsetY(parseInt(e.target.value))} />
                  </div>
                </div>

                {/* Custom background color */}
                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center gap-3">
                    <Switch checked={logoUseCustomBg} onCheckedChange={setLogoUseCustomBg} id="logo-custom-bg" disabled={logoTransparentBg} />
                    <Label htmlFor="logo-custom-bg" className="text-xs">
                      {ar ? "استخدم لون خلفية مخصص للشعار" : "Use custom background color"}
                    </Label>
                  </div>
                  {logoUseCustomBg && !logoTransparentBg && (
                    <div className="flex items-center gap-2">
                      <input type="color" value={logoBgColor} onChange={e => setLogoBgColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                      <Input value={logoBgColor} onChange={e => setLogoBgColor(e.target.value)} className="h-9 w-32 font-mono text-xs" />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLogoOffsetX(0); setLogoOffsetY(0); setLogoAlign("start");
                    setLogoUseCustomBg(false); setLogoBgColor("#ffffff");
                    setLogoTransparentBg(false); setLogoSize(60); setLogoPadding(0); setLogoRadius(0);
                  }}
                  className="text-[11px] text-muted-foreground underline hover:text-foreground"
                >
                  {ar ? "إعادة تعيين إعدادات الشعار" : "Reset logo settings"}
                </button>
              </div>

              {/* Font family */}
              <div className="space-y-3 border rounded-lg p-3">
                <div className="font-semibold text-sm flex items-center gap-2"><Type className="w-4 h-4" />{ar ? "نوع الخط" : "Font Family"}</div>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{ar ? "افتراضي النظام" : "System default"}</SelectItem>
                    <SelectItem value="tajawal">Tajawal — تجوال</SelectItem>
                    <SelectItem value="cairo">Cairo — القاهرة</SelectItem>
                    <SelectItem value="almarai">Almarai — المراعي</SelectItem>
                    <SelectItem value="ibm-plex">IBM Plex Sans Arabic</SelectItem>
                    <SelectItem value="readex">Readex Pro</SelectItem>
                    <SelectItem value="noto-kufi">Noto Kufi Arabic — كوفي</SelectItem>
                  </SelectContent>
                </Select>
                <div
                  className="rounded p-3 text-center bg-muted/30 border"
                  style={{ fontFamily: getFontStack(fontFamily) }}
                >
                  <div className="text-lg font-bold">{ar ? "نموذج: فرص وظيفية مميزة" : "Sample: Job Opportunities"}</div>
                  <div className="text-sm text-muted-foreground mt-1">NexHire AI · منصة التوظيف الذكية</div>
                </div>
              </div>

              {/* Title alignment & nudging */}
              <div className="space-y-3 border rounded-lg p-3">
                <div className="font-semibold text-sm">{ar ? "محاذاة وموضع العناوين" : "Title Alignment & Position"}</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? "محاذاة العنوان العربي" : "Arabic title align"}</Label>
                    <Select value={titleAlignAr} onValueChange={(v: any) => setTitleAlignAr(v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end">{ar ? "يمين" : "Right"}</SelectItem>
                        <SelectItem value="center">{ar ? "وسط" : "Center"}</SelectItem>
                        <SelectItem value="start">{ar ? "يسار" : "Left"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? "محاذاة العنوان الإنجليزي" : "English title align"}</Label>
                    <Select value={titleAlignEn} onValueChange={(v: any) => setTitleAlignEn(v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start">{ar ? "يسار" : "Left"}</SelectItem>
                        <SelectItem value="center">{ar ? "وسط" : "Center"}</SelectItem>
                        <SelectItem value="end">{ar ? "يمين" : "Right"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `إزاحة أفقية: ${titleOffsetX}px` : `Horizontal offset: ${titleOffsetX}px`}</Label>
                    <Input type="range" min={-60} max={60} value={titleOffsetX} onChange={e => setTitleOffsetX(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `إزاحة عمودية: ${titleOffsetY}px` : `Vertical offset: ${titleOffsetY}px`}</Label>
                    <Input type="range" min={-30} max={30} value={titleOffsetY} onChange={e => setTitleOffsetY(parseInt(e.target.value))} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {ar ? "💡 المحاذاة + الإزاحة تتحكمان بمكان العنوان داخل الإعلان." : "💡 Alignment + offsets control title placement inside the ad."}
                </p>
              </div>
            </TabsContent>

            {/* PREMIUM TEMPLATE TUNING */}
            <TabsContent value="alkholi" className="space-y-5">
              <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
                {ar
                  ? "هذه الإعدادات تؤثر على «القالب المميز» فقط. اختر النمط من تبويب التصميم أولاً."
                  : "These controls affect the Premium template only. Pick that style from the Design tab first."}
              </div>

              {/* Header IMAGE upload */}
              <div className="space-y-3 border rounded-lg p-3">
                <div className="font-semibold text-sm">{ar ? "🖼️ صورة الهيدر (من مكتبة الصور)" : "🖼️ Header Image (from your library)"}</div>
                <AssetUpload
                  label={ar ? "ارفع صورة هيدر مخصصة" : "Upload custom header image"}
                  url={headerImageUrl}
                  uploading={uploadingHeaderImg}
                  onFile={(f) => uploadAsset(f, "header")}
                  onClear={() => setHeaderImageUrl(null)}
                  ar={ar}
                />
                {headerImageUrl && (
                  <>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{ar ? "نوع التغطية" : "Fit"}</Label>
                        <Select value={headerImgFit} onValueChange={(v: any) => setHeaderImgFit(v)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cover">{ar ? "تغطية" : "Cover"}</SelectItem>
                            <SelectItem value="contain">{ar ? "احتواء" : "Contain"}</SelectItem>
                            <SelectItem value="fill">{ar ? "تمدد" : "Fill"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{ar ? `الشفافية: ${headerImgOpacity}%` : `Opacity: ${headerImgOpacity}%`}</Label>
                        <Input type="range" min={20} max={100} value={headerImgOpacity} onChange={e => setHeaderImgOpacity(parseInt(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{ar ? `موضع رأسي: ${headerImgPosY}%` : `Vertical position: ${headerImgPosY}%`}</Label>
                        <Input type="range" min={0} max={100} value={headerImgPosY} onChange={e => setHeaderImgPosY(parseInt(e.target.value))} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={hideHeaderChevron} onCheckedChange={setHideHeaderChevron} id="hide-chev" />
                      <Label htmlFor="hide-chev" className="text-xs">{ar ? "إخفاء الشيفرون عند استخدام الصورة" : "Hide chevron band when image is used"}</Label>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-3 border rounded-lg p-3">
                <div className="font-semibold text-sm">{ar ? "الحدود العلوية (الهيدر)" : "Top Header Border"}</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `ارتفاع الهيدر: ${akHeaderHeight}px` : `Header height: ${akHeaderHeight}px`}</Label>
                    <Input type="range" min={60} max={260} value={akHeaderHeight} onChange={e => setAkHeaderHeight(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `موضع زاوية الشيفرون: ${akHeaderChevronPos}%` : `Chevron position: ${akHeaderChevronPos}%`}</Label>
                    <Input type="range" min={10} max={90} value={akHeaderChevronPos} onChange={e => setAkHeaderChevronPos(parseInt(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* Footer chevron */}
              <div className="space-y-3 border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{ar ? "الحدود السفلية" : "Bottom Border"}</div>
                  <div className="flex items-center gap-2">
                    <Switch checked={akShowFooterChevron} onCheckedChange={setAkShowFooterChevron} id="ak-foot" />
                    <Label htmlFor="ak-foot" className="text-xs">{ar ? "إظهار" : "Show"}</Label>
                  </div>
                </div>
                {akShowFooterChevron && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{ar ? `ارتفاع الفوتر: ${akFooterHeight}px` : `Footer height: ${akFooterHeight}px`}</Label>
                      <Input type="range" min={20} max={160} value={akFooterHeight} onChange={e => setAkFooterHeight(parseInt(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{ar ? `موضع زاوية الشيفرون: ${akFooterChevronPos}%` : `Chevron peak: ${akFooterChevronPos}%`}</Label>
                      <Input type="range" min={10} max={90} value={akFooterChevronPos} onChange={e => setAkFooterChevronPos(parseInt(e.target.value))} />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer IMAGE upload */}
              <div className="space-y-3 border rounded-lg p-3">
                <div className="font-semibold text-sm">{ar ? "🖼️ صورة الفوتر (هيدر سفلي مخصص)" : "🖼️ Footer Image (custom bottom header)"}</div>
                <AssetUpload
                  label={ar ? "ارفع صورة فوتر مخصصة" : "Upload custom footer image"}
                  url={footerImageUrl}
                  uploading={uploadingFooterImg}
                  onFile={(f) => uploadAsset(f, "footer")}
                  onClear={() => setFooterImageUrl(null)}
                  ar={ar}
                />
                {footerImageUrl && (
                  <>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{ar ? "نوع التغطية" : "Fit"}</Label>
                        <Select value={footerImgFit} onValueChange={(v: any) => setFooterImgFit(v)}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cover">{ar ? "تغطية" : "Cover"}</SelectItem>
                            <SelectItem value="contain">{ar ? "احتواء" : "Contain"}</SelectItem>
                            <SelectItem value="fill">{ar ? "تمدد" : "Fill"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{ar ? `الشفافية: ${footerImgOpacity}%` : `Opacity: ${footerImgOpacity}%`}</Label>
                        <Input type="range" min={20} max={100} value={footerImgOpacity} onChange={e => setFooterImgOpacity(parseInt(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{ar ? `موضع رأسي: ${footerImgPosY}%` : `Vertical position: ${footerImgPosY}%`}</Label>
                        <Input type="range" min={0} max={100} value={footerImgPosY} onChange={e => setFooterImgPosY(parseInt(e.target.value))} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={hideFooterChevron} onCheckedChange={setHideFooterChevron} id="hide-foot-chev" />
                      <Label htmlFor="hide-foot-chev" className="text-xs">{ar ? "إخفاء الشيفرون السفلي عند استخدام الصورة" : "Hide footer chevron when image is used"}</Label>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-3 border rounded-lg p-3">
                <div className="font-semibold text-sm">{ar ? "حجم النصوص" : "Typography"}</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `حجم خط الوظائف: ${akBodyFontSize ?? "تلقائي"}` : `Jobs font size: ${akBodyFontSize ?? "auto"}`}</Label>
                    <Input type="range" min={7} max={18} value={akBodyFontSize ?? 12} onChange={e => setAkBodyFontSize(parseInt(e.target.value))} />
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setAkBodyFontSize(null)}>{ar ? "تلقائي" : "Auto"}</Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `حجم العنوان: ${akTitleFontSize}px` : `Title size: ${akTitleFontSize}px`}</Label>
                    <Input type="range" min={16} max={56} value={akTitleFontSize} onChange={e => setAkTitleFontSize(parseInt(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* Page geometry */}
              <div className="space-y-3 border rounded-lg p-3">
                <div className="font-semibold text-sm">{ar ? "حجم الصفحة والهوامش" : "Page Size & Padding"}</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `العرض (mm): ${akPageWidthMm}` : `Width (mm): ${akPageWidthMm}`}</Label>
                    <Input type="range" min={148} max={300} value={akPageWidthMm} onChange={e => setAkPageWidthMm(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `الارتفاع (mm): ${akPageHeightMm}` : `Height (mm): ${akPageHeightMm}`}</Label>
                    <Input type="range" min={210} max={420} value={akPageHeightMm} onChange={e => setAkPageHeightMm(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `هامش جانبي: ${akPagePaddingX}px` : `Side padding: ${akPagePaddingX}px`}</Label>
                    <Input type="range" min={10} max={80} value={akPagePaddingX} onChange={e => setAkPagePaddingX(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `هامش علوي: ${akPagePaddingTop}px` : `Top padding: ${akPagePaddingTop}px`}</Label>
                    <Input type="range" min={0} max={60} value={akPagePaddingTop} onChange={e => setAkPagePaddingTop(parseInt(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? `هامش سفلي: ${akPagePaddingBottom}px` : `Bottom padding: ${akPagePaddingBottom}px`}</Label>
                    <Input type="range" min={20} max={140} value={akPagePaddingBottom} onChange={e => setAkPagePaddingBottom(parseInt(e.target.value))} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={akSinglePage} onCheckedChange={setAkSinglePage} id="ak-single" />
                    <Label htmlFor="ak-single" className="text-xs">{ar ? "إجبار صفحة واحدة عند الطباعة" : "Force single page on print"}</Label>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap gap-2 pt-4 border-t mt-4">
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" />{editingId ? (ar ? "حفظ التعديلات" : "Save Changes") : (ar ? "حفظ الإعلان" : "Save Ad")}</Button>
            <Button variant="secondary" onClick={() => setShowPreview(p => !p)} className="gap-2"><Eye className="w-4 h-4" />{showPreview ? (ar ? "إخفاء المعاينة" : "Hide Preview") : (ar ? "إظهار المعاينة" : "Show Preview")}</Button>
            <Button variant="outline" onClick={handlePrint} disabled={allRenderJobs.length === 0} className="gap-2"><Printer className="w-4 h-4" />{ar ? "طباعة / PDF" : "Print / PDF"}</Button>
            <Button variant="outline" onClick={() => handlePreviewExport("png", 3)} disabled={allRenderJobs.length === 0 || downloading} className="gap-2">
              <Download className="w-4 h-4" />{downloading ? (ar ? "جاري التوليد..." : "Generating...") : (ar ? "معاينة PNG (3x)" : "Preview PNG (3x)")}
            </Button>
            <Button variant="outline" onClick={() => handlePreviewExport("png", 5)} disabled={allRenderJobs.length === 0 || downloading} className="gap-2">
              <Download className="w-4 h-4" />{ar ? "معاينة PNG (5x فائقة)" : "Preview PNG (5x Ultra)"}
            </Button>
            <Button variant="outline" onClick={() => handlePreviewExport("jpeg", 3)} disabled={allRenderJobs.length === 0 || downloading} className="gap-2">
              <Download className="w-4 h-4" />{ar ? "معاينة JPG" : "Preview JPG"}
            </Button>
            {editingId && <Button variant="ghost" onClick={resetEditor} className="gap-2"><Plus className="w-4 h-4" />{ar ? "إعلان جديد" : "New Ad"}</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Saved Ads List */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>{ar ? "الإعلانات المحفوظة" : "Saved Advertisements"} ({ads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ads.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-6">{ar ? "لا توجد إعلانات محفوظة بعد" : "No saved advertisements yet"}</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ads.map(ad => {
                const totalJobs = (ad.job_ids?.length || 0) + (Array.isArray(ad.manual_jobs) ? ad.manual_jobs.length : 0);
                return (
                  <div key={ad.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{ar ? ad.title_ar : (ad.title_en || ad.title_ar)}</div>
                        <div className="text-xs text-muted-foreground mt-1">{totalJobs} {ar ? "وظيفة" : "jobs"} · {new Date(ad.created_at).toLocaleDateString(ar ? "ar-EG" : "en-US")}</div>
                        {ad.created_by_email && <div className="text-[10px] text-muted-foreground mt-1 truncate">{ad.created_by_email}</div>}
                      </div>
                      <Badge style={{ backgroundColor: ad.accent_color || undefined }} className="text-white text-[10px]">
                        {DESIGN_STYLES.find(s => s.value === ad.design_style)?.[ar ? "label_ar" : "label_en"]}
                      </Badge>
                    </div>
                    <div className="flex gap-1 mt-3">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => loadAd(ad)}><FileEdit className="w-3 h-3" />{ar ? "تعديل" : "Edit"}</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => handleDelete(ad.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview / Print Area */}
      {allRenderJobs.length > 0 && showPreview && (
        <Card>
          <CardHeader className="no-print">
            <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />{ar ? "معاينة الإعلان" : "Ad Preview"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 bg-muted/20 overflow-auto">
            <div id="ad-print-area" ref={printRef} dir={dir}>
              <AdRenderer
                style={designStyle}
                layout={layoutType}
                accent={accentColor}
                secondary={secondaryColor}
                textColor={textColor}
                titleAr={titleAr}
                titleEn={titleEn}
                subtitleAr={subtitleAr}
                subtitleEn={subtitleEn}
                jobs={allRenderJobs as any}
                logoUrl={logoUrl}
                backgroundUrl={backgroundUrl}
                showQr={showQr}
                qrUrl={qrUrl}
                ar={ar}
                bilingualMode={bilingualMode}
                showVacancyPerJob={showVacancyPerJob}
                showTotalVacancies={showTotalVacancies}
                totalVacancies={totalVacancies === "" ? null : Number(totalVacancies)}
                campaignLocationAr={campaignLocationAr}
                campaignLocationEn={campaignLocationEn}
                showCampaignLocation={showCampaignLocation}
                headerImageUrl={headerImageUrl}
                headerImgFit={headerImgFit}
                headerImgOpacity={headerImgOpacity}
                headerImgPosY={headerImgPosY}
                hideHeaderChevron={hideHeaderChevron}
                footerImageUrl={footerImageUrl}
                footerImgFit={footerImgFit}
                footerImgOpacity={footerImgOpacity}
                footerImgPosY={footerImgPosY}
                hideFooterChevron={hideFooterChevron}
                ak={{
                  headerHeight: akHeaderHeight,
                  headerChevronPos: akHeaderChevronPos,
                  showFooterChevron: akShowFooterChevron,
                  footerHeight: akFooterHeight,
                  footerChevronPos: akFooterChevronPos,
                  bodyFontSize: akBodyFontSize,
                  titleFontSize: akTitleFontSize,
                  pagePaddingX: akPagePaddingX,
                  pagePaddingTop: akPagePaddingTop,
                  pagePaddingBottom: akPagePaddingBottom,
                  pageHeightMm: akPageHeightMm,
                  pageWidthMm: akPageWidthMm,
                  singlePage: akSinglePage,
                }}
                logoTransparentBg={logoTransparentBg}
                logoSize={logoSize}
                logoPadding={logoPadding}
                logoRadius={logoRadius}
                logoOffsetX={logoOffsetX}
                logoOffsetY={logoOffsetY}
                logoAlign={logoAlign}
                logoBgColor={logoBgColor}
                logoUseCustomBg={logoUseCustomBg}
                fontFamily={fontFamily}
                titleAlignAr={titleAlignAr}
                titleAlignEn={titleAlignEn}
                titleOffsetX={titleOffsetX}
                titleOffsetY={titleOffsetY}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Preview Dialog */}
      <Dialog open={!!previewImg} onOpenChange={(o) => !o && setPreviewImg(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {ar ? "معاينة الصورة قبل التحميل" : "Export Preview"}
            </DialogTitle>
          </DialogHeader>
          {previewImg && (
            <>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground border-b pb-2">
                <Badge variant="secondary">{previewImg.format.toUpperCase()}</Badge>
                <Badge variant="secondary">{previewImg.scale}x {ar ? "دقة" : "scale"}</Badge>
                <Badge variant="secondary">~{(previewImg.sizeKb / 1024).toFixed(2)} MB</Badge>
              </div>
              <div className="flex-1 overflow-auto bg-muted/30 rounded p-2 flex items-center justify-center min-h-[300px]">
                <img src={previewImg.url} alt="export preview" className="max-w-full max-h-[60vh] object-contain shadow-lg" />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setPreviewImg(null)}>
                  {ar ? "إلغاء" : "Cancel"}
                </Button>
                <Button onClick={() => window.open(previewImg.url, "_blank")} variant="secondary" className="gap-2">
                  <Eye className="w-4 h-4" />{ar ? "فتح بحجم كامل" : "Open Full Size"}
                </Button>
                <Button onClick={confirmDownload} className="gap-2">
                  <Download className="w-4 h-4" />{ar ? "تحميل الصورة" : "Download"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============== Asset Upload Subcomponent ==============
const AssetUpload = ({ label, url, uploading, onFile, onClear, ar }: {
  label: string; url: string | null; uploading: boolean; onFile: (f: File) => void; onClear: () => void; ar: boolean;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border rounded-lg p-3 flex items-center gap-3 bg-muted/20">
        {url ? (
          <img src={url} alt="" className="w-20 h-20 rounded object-cover border" />
        ) : (
          <div className="w-20 h-20 rounded border-2 border-dashed flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 flex flex-col gap-2">
          <input
            ref={ref} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          />
          <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={uploading} className="gap-1">
            <Upload className="w-3.5 h-3.5" />{uploading ? (ar ? "جار الرفع..." : "Uploading...") : (url ? (ar ? "تغيير" : "Change") : (ar ? "رفع" : "Upload"))}
          </Button>
          {url && (
            <Button size="sm" variant="ghost" onClick={onClear} className="gap-1 text-destructive h-7">
              <X className="w-3.5 h-3.5" />{ar ? "إزالة" : "Remove"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// =================== Ad Renderer ===================
interface RenderJob {
  id: string;
  title_ar: string;
  title_en: string;
  location: string;
  location_en: string | null;
  job_type: string;
  job_type_en: string | null;
  department: string | null;
  department_en: string | null;
  vacancy_count: number;
  nationality_required: string | null;
  isManual: boolean;
}

interface AdRendererProps {
  style: string;
  layout: string;
  accent: string;
  secondary: string;
  textColor: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  jobs: RenderJob[];
  logoUrl: string | null;
  backgroundUrl: string | null;
  showQr: boolean;
  qrUrl: string;
  ar: boolean;
  bilingualMode: "ar" | "en" | "both";
  showVacancyPerJob: boolean;
  showTotalVacancies: boolean;
  totalVacancies: number | null;
  campaignLocationAr?: string;
  campaignLocationEn?: string;
  showCampaignLocation?: boolean;
  headerImageUrl?: string | null;
  headerImgFit?: "cover" | "contain" | "fill";
  headerImgOpacity?: number;
  headerImgPosY?: number;
  hideHeaderChevron?: boolean;
  footerImageUrl?: string | null;
  footerImgFit?: "cover" | "contain" | "fill";
  footerImgOpacity?: number;
  footerImgPosY?: number;
  hideFooterChevron?: boolean;
  logoTransparentBg?: boolean;
  logoSize?: number;
  logoPadding?: number;
  logoRadius?: number;
  logoOffsetX?: number;
  logoOffsetY?: number;
  logoAlign?: "start" | "center" | "end";
  logoBgColor?: string;
  logoUseCustomBg?: boolean;
  fontFamily?: string;
  titleAlignAr?: "start" | "center" | "end";
  titleAlignEn?: "start" | "center" | "end";
  titleOffsetX?: number;
  titleOffsetY?: number;
  ak?: {
    headerHeight: number;
    headerChevronPos: number;
    showFooterChevron: boolean;
    footerHeight: number;
    footerChevronPos: number;
    bodyFontSize: number | null;
    titleFontSize: number;
    pagePaddingX: number;
    pagePaddingTop: number;
    pagePaddingBottom: number;
    pageHeightMm: number;
    pageWidthMm: number;
    singlePage: boolean;
  };
}

// Helper: pick text per bilingual mode
const pickTitles = (job: RenderJob, mode: "ar" | "en" | "both") => {
  if (mode === "ar") return { primary: job.title_ar, secondary: null };
  if (mode === "en") return { primary: job.title_en, secondary: null };
  return { primary: job.title_ar, secondary: job.title_en };
};

const pickHeader = (ar: string, en: string, mode: "ar" | "en" | "both") => {
  if (mode === "ar") return { primary: ar, secondary: null };
  if (mode === "en") return { primary: en || ar, secondary: null };
  return { primary: ar, secondary: en || null };
};

const AdRenderer = (props: AdRendererProps) => {
  const {
    style, layout, accent, secondary, textColor,
    titleAr, titleEn, subtitleAr, subtitleEn,
    jobs, logoUrl, backgroundUrl, showQr, qrUrl, ar,
    bilingualMode, showVacancyPerJob, showTotalVacancies, totalVacancies, ak,
    campaignLocationAr = "", campaignLocationEn = "", showCampaignLocation = true,
    headerImageUrl = null, headerImgFit = "cover", headerImgOpacity = 100, headerImgPosY = 50, hideHeaderChevron = false,
    footerImageUrl = null, footerImgFit = "cover", footerImgOpacity = 100, footerImgPosY = 50, hideFooterChevron = false,
    logoTransparentBg = false, logoSize = 60, logoPadding = 0, logoRadius = 0,
    logoOffsetX = 0, logoOffsetY = 0, logoAlign = "start", logoBgColor = "#ffffff", logoUseCustomBg = false,
    fontFamily: fontKey = "system",
    titleAlignAr = "end", titleAlignEn = "start", titleOffsetX = 0, titleOffsetY = 0,
  } = props;

  const headerTitle = pickHeader(titleAr, titleEn, bilingualMode);
  const headerSub = pickHeader(subtitleAr, subtitleEn, bilingualMode);

  // Density-aware sizing so it fits in one A4 page
  const n = jobs.length;
  const density: "loose" | "normal" | "tight" | "ultra" =
    n <= 6 ? "loose" : n <= 12 ? "normal" : n <= 20 ? "tight" : "ultra";
  const cardPad = density === "loose" ? 14 : density === "normal" ? 11 : density === "tight" ? 8 : 6;
  const titleFs = density === "loose" ? 15 : density === "normal" ? 13 : density === "tight" ? 12 : 11;
  const subFs = density === "loose" ? 12 : density === "normal" ? 11 : 10;
  const gap = density === "loose" ? 12 : density === "normal" ? 10 : 8;

  const totalAuto = totalVacancies ?? jobs.reduce((s, j) => s + (j.vacancy_count || 1), 0);

  const isAlk = style === "alkholi-official";
  const pageW = ak?.pageWidthMm ?? 210;
  const pageH = ak?.pageHeightMm ?? 297;

  const containerStyle: React.CSSProperties = {
    width: `${pageW}mm`,
    minHeight: `${pageH}mm`,
    ...(isAlk && ak?.singlePage ? { height: `${pageH}mm`, maxHeight: `${pageH}mm` } : {}),
    margin: "0 auto",
    background: "white",
    color: "#0f172a",
    boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
    overflow: "hidden",
    position: "relative",
    fontFamily: getFontStack(fontKey),
  };

  const headerBgStyle: React.CSSProperties = backgroundUrl
    ? { backgroundImage: `linear-gradient(135deg, ${accent}d9 0%, ${secondary}d9 100%), url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(135deg, ${accent} 0%, ${secondary} 100%)` };

  // ========== JOB CARD (bilingual aware) ==========
  const JobTitle = ({ job, color = "#0f172a" }: { job: RenderJob; color?: string }) => {
    const t = pickTitles(job, bilingualMode);
    return (
      <div>
        <h3 style={{ fontSize: titleFs, fontWeight: 800, margin: 0, color, lineHeight: 1.2 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>
          {t.primary}
        </h3>
        {t.secondary && (
          <div style={{ fontSize: titleFs - 3, fontWeight: 500, color: "#64748b", marginTop: 2, letterSpacing: 0.2 }} dir="ltr">
            {t.secondary}
          </div>
        )}
      </div>
    );
  };

  const VacancyChip = ({ job, color }: { job: RenderJob; color: string }) =>
    showVacancyPerJob ? (
      <div style={{ background: `${color}18`, color, padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>
        {job.vacancy_count} {ar ? "شاغر" : "open"}
      </div>
    ) : null;

  // ========== LAYOUTS ==========
  const renderJobsByLayout = () => {
    const cols = layout === "two-col" ? 2 : n > 12 ? 3 : n > 4 ? 2 : 1;

    // Premium template body
    if (style === "alkholi-official") {
      const colCount = n > 22 ? 2 : 1;
      const fs = ak?.bodyFontSize ?? (n > 30 ? 10 : n > 22 ? 11 : n > 14 ? 12 : 13);
      return (
        <div style={{ display: "grid", gridTemplateColumns: showQr && qrUrl ? "1fr 160px" : "1fr", gap: 24, alignItems: "start" }}>
          <div style={{ columns: colCount, columnGap: 28 }}>
            {jobs.map((job) => {
              const en = job.title_en || job.title_ar;
              const arT = job.title_ar || job.title_en;
              return (
                <div key={job.id} style={{ breakInside: "avoid", display: "grid", gridTemplateColumns: "auto 1fr 8px 1fr", alignItems: "baseline", columnGap: 6, padding: "3px 0", fontSize: fs, lineHeight: 1.45 }}>
                  <span style={{ color: accent, fontSize: fs + 4, lineHeight: 1, marginTop: 2 }}>•</span>
                  <span style={{ color: "#0f172a", fontWeight: 600, textAlign: "left" }} dir="ltr">{en}</span>
                  <span style={{ color: "#94a3b8", fontSize: fs - 1, textAlign: "center" }}>—</span>
                  <span style={{ color: "#0f172a", fontWeight: 600, textAlign: "right" }} dir="rtl">{arT}</span>
                </div>
              );
            })}
          </div>
          {showQr && qrUrl && (
            <div style={{ textAlign: "center", paddingTop: 4 }}>
              <div style={{ fontSize: 13, color: accent, fontWeight: 800, marginBottom: 2 }} dir="rtl">التقديم عبر الباركود</div>
              <div style={{ fontSize: 13, color: accent, fontWeight: 800, marginBottom: 8 }} dir="ltr">Scan to Apply</div>
              <div style={{ display: "inline-block", padding: 6, background: "white", border: `1px solid ${accent}22` }}>
                <QRCodeSVG value={qrUrl} size={140} />
              </div>
              <div style={{ fontSize: 9, color: "#64748b", marginTop: 6, wordBreak: "break-all", maxWidth: 150 }} dir="ltr">{qrUrl}</div>
            </div>
          )}
        </div>
      );
    }


    if (layout === "cascade") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap }}>
          {jobs.map((job, i) => (
            <div key={job.id} style={{
              background: "white", borderRadius: 10, padding: `${cardPad}px ${cardPad + 4}px`,
              borderInlineStart: `4px solid ${accent}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              marginInlineStart: `${Math.min(i * 8, 48)}px`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ fontSize: 20, fontWeight: 200, color: accent, minWidth: 28 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ flex: 1 }}><JobTitle job={job} /><CompactMeta job={job} ar={ar} accent={accent} fs={subFs} /></div>
              <VacancyChip job={job} color={accent} />
            </div>
          ))}
        </div>
      );
    }

    if (layout === "masonry") {
      return (
        <div style={{ columns: cols, columnGap: gap }}>
          {jobs.map((job, i) => (
            <div key={job.id} style={{
              breakInside: "avoid",
              background: i % 3 === 0 ? `${accent}10` : i % 3 === 1 ? `${secondary}10` : "white",
              border: `1px solid ${accent}25`, borderRadius: 12, padding: cardPad, marginBottom: gap,
            }}>
              <div style={{ fontSize: 9, color: accent, letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>#{String(i + 1).padStart(2, "0")}</div>
              <JobTitle job={job} />
              <CompactMeta job={job} ar={ar} accent={accent} fs={subFs} />
              <VacancyChip job={job} color={accent} />
            </div>
          ))}
        </div>
      );
    }

    if (layout === "list") {
      return (
        <div>
          {jobs.map((job, i) => (
            <div key={job.id} style={{ padding: `${cardPad}px 0`, borderBottom: i < n - 1 ? `1px solid ${accent}22` : "none", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 22, fontWeight: 200, color: accent, minWidth: 36 }}>{String(i + 1).padStart(2, "0")}</span>
              <div style={{ flex: 1 }}><JobTitle job={job} /><CompactMeta job={job} ar={ar} accent={accent} fs={subFs} /></div>
              <VacancyChip job={job} color={accent} />
            </div>
          ))}
        </div>
      );
    }

    if (layout === "two-col") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap }}>
          {jobs.map((job, i) => (
            <div key={job.id} style={{
              background: "white", borderRadius: 10, padding: cardPad,
              border: `1.5px solid ${accent}40`, borderInlineStart: `4px solid ${accent}`,
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ fontSize: 9, color: accent, fontWeight: 700, letterSpacing: 1.5 }}>{String(i + 1).padStart(2, "0")}</div>
              <JobTitle job={job} />
              <CompactMeta job={job} ar={ar} accent={accent} fs={subFs} />
              <VacancyChip job={job} color={accent} />
            </div>
          ))}
        </div>
      );
    }

    if (layout === "hexagon") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap, padding: "8px 0" }}>
          {jobs.map((job, i) => (
            <div key={job.id} style={{
              background: i % 2 === 0 ? `linear-gradient(135deg, ${accent}, ${secondary})` : "white",
              color: i % 2 === 0 ? "white" : "#0f172a",
              border: i % 2 === 0 ? "none" : `2px solid ${accent}`,
              borderRadius: 16, padding: cardPad, textAlign: "center",
              clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
              minHeight: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, opacity: 0.7 }}>#{i + 1}</div>
              <h3 style={{ fontSize: titleFs - 1, fontWeight: 800, margin: 0, lineHeight: 1.15 }}>{ar ? job.title_ar : job.title_en}</h3>
              {bilingualMode === "both" && <div style={{ fontSize: 9, opacity: 0.85 }} dir="ltr">{job.title_en}</div>}
              {showVacancyPerJob && <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2 }}>{job.vacancy_count} {ar ? "شاغر" : "open"}</div>}
            </div>
          ))}
        </div>
      );
    }

    if (layout === "timeline") {
      return (
        <div style={{ position: "relative", paddingInlineStart: 28 }}>
          <div style={{ position: "absolute", insetInlineStart: 10, top: 6, bottom: 6, width: 2, background: `${accent}40` }} />
          {jobs.map((job, i) => (
            <div key={job.id} style={{ position: "relative", padding: `${cardPad - 2}px 0`, marginBottom: 4 }}>
              <div style={{ position: "absolute", insetInlineStart: -22, top: cardPad, width: 14, height: 14, borderRadius: "50%", background: accent, border: "3px solid white", boxShadow: `0 0 0 2px ${accent}50` }} />
              <div style={{ background: "white", border: `1px solid ${accent}25`, borderRadius: 10, padding: cardPad, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 200, color: accent, minWidth: 28 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ flex: 1 }}><JobTitle job={job} /><CompactMeta job={job} ar={ar} accent={accent} fs={subFs} /></div>
                <VacancyChip job={job} color={accent} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (layout === "tags") {
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: gap - 2, alignContent: "flex-start" }}>
          {jobs.map((job, i) => (
            <div key={job.id} style={{
              background: i % 4 === 0 ? accent : i % 4 === 1 ? secondary : "white",
              color: i % 4 < 2 ? "white" : "#0f172a",
              border: i % 4 < 2 ? "none" : `1.5px solid ${accent}`,
              borderRadius: 999, padding: `${cardPad - 4}px ${cardPad + 4}px`,
              fontSize: titleFs - 1, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ opacity: 0.6, fontSize: 10 }}>#{i + 1}</span>
              <span>{ar ? job.title_ar : job.title_en}</span>
              {bilingualMode === "both" && <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 500 }} dir="ltr">/ {job.title_en}</span>}
              {showVacancyPerJob && <span style={{ background: "rgba(255,255,255,0.25)", padding: "1px 6px", borderRadius: 4, fontSize: 9 }}>{job.vacancy_count}</span>}
            </div>
          ))}
        </div>
      );
    }

    if (layout === "compact") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {jobs.map((job, i) => (
            <div key={job.id} style={{
              background: i % 2 === 0 ? `${accent}08` : "white",
              border: `1px solid ${accent}20`, borderRadius: 6, padding: 7,
            }}>
              <div style={{ fontSize: 8, color: accent, fontWeight: 700 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", lineHeight: 1.15 }}>{ar ? job.title_ar : job.title_en}</div>
              {bilingualMode === "both" && <div style={{ fontSize: 9, color: "#64748b" }} dir="ltr">{job.title_en}</div>}
              {showVacancyPerJob && <div style={{ fontSize: 9, color: secondary, fontWeight: 700, marginTop: 2 }}>×{job.vacancy_count}</div>}
            </div>
          ))}
        </div>
      );
    }

    if (layout === "numbered") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: cols === 1 ? "1fr" : "1fr 1fr", gap }}>
          {jobs.map((job, i) => (
            <div key={job.id} style={{ display: "flex", alignItems: "stretch", gap: 0, borderRadius: 10, overflow: "hidden", border: `1px solid ${accent}30` }}>
              <div style={{ background: `linear-gradient(135deg, ${accent}, ${secondary})`, color: "white", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, minWidth: 56 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ flex: 1, padding: cardPad, background: "white" }}>
                <JobTitle job={job} color={accent} />
                <CompactMeta job={job} ar={ar} accent={accent} fs={subFs} />
                <VacancyChip job={job} color={accent} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // grid (default)
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
        {jobs.map((job, i) => (
          <div key={job.id} style={{
            background: "white", borderRadius: 10, padding: cardPad,
            border: `2px solid ${accent}`, position: "relative",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{ position: "absolute", top: -9, [ar ? "right" : "left"]: 12, background: accent, color: "white", padding: "2px 9px", borderRadius: 5, fontSize: 9, fontWeight: 800 } as any}>
              #{String(i + 1).padStart(2, "0")}
            </div>
            <JobTitle job={job} color={accent} />
            <CompactMeta job={job} ar={ar} accent={accent} fs={subFs} />
            <VacancyChip job={job} color={secondary} />
          </div>
        ))}
      </div>
    );
  };

  // ========== HEADER (style-specific) ==========
  const taglineMap: Record<string, { ar: string; en: string }> = {
    luxury: { ar: "✦ فرص استثنائية ✦", en: "✦ EXCEPTIONAL OPPORTUNITIES ✦" },
    corporate: { ar: "إعلان توظيف رسمي", en: "OFFICIAL HIRING NOTICE" },
    creative: { ar: "🎨 انضم لرحلتنا", en: "🎨 JOIN OUR JOURNEY" },
    geometric: { ar: "◆ وظائف شاغرة ◆", en: "◆ OPEN POSITIONS ◆" },
    gradient: { ar: "نوظف الآن", en: "NOW HIRING" },
    magazine: { ar: "العدد الجديد · فرص مهنية", en: "NEW ISSUE · CAREERS" },
    bold: { ar: "🚀 نعلن عن وظائف", en: "🚀 WE'RE HIRING" },
    modern: { ar: "✨ فرص وظيفية", en: "✨ HIRING NOW" },
  };
  const tag = taglineMap[style] || taglineMap.modern;

  const HeroHeader = ({ big = false }: { big?: boolean }) => (
    <div style={{ ...headerBgStyle, color: textColor, padding: big ? "44px 36px 50px" : "36px 32px", position: "relative", overflow: "hidden" }}>
      {logoUrl && (
        <img src={logoUrl} alt="logo"
          style={{ position: "absolute", top: 18, [ar ? "right" : "left"]: 22, height: 50, maxWidth: 130, objectFit: "contain", background: "white", padding: 5, borderRadius: 9 } as any}
        />
      )}
      <div style={{ position: "absolute", top: -60, [ar ? "left" : "right"]: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.08)" } as any} />
      <div style={{ position: "relative", zIndex: 1, marginTop: logoUrl ? 36 : 0 }}>
        <div style={{ display: "inline-block", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", padding: "5px 13px", borderRadius: 18, fontSize: 10, letterSpacing: 3, marginBottom: 12, fontWeight: 700 }}>
          {ar ? tag.ar : tag.en}
        </div>
        <h1 style={{ fontSize: big ? 38 : 34, fontWeight: 900, margin: 0, lineHeight: 1.15 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>
          {headerTitle.primary}
        </h1>
        {headerTitle.secondary && (
          <div style={{ fontSize: 18, fontWeight: 600, opacity: 0.92, marginTop: 4 }} dir="ltr">
            {headerTitle.secondary}
          </div>
        )}
        {headerSub.primary && <p style={{ fontSize: 15, opacity: 0.95, marginTop: 10, marginBottom: 0 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>{headerSub.primary}</p>}
        {headerSub.secondary && <p style={{ fontSize: 13, opacity: 0.85, marginTop: 2, marginBottom: 0 }} dir="ltr">{headerSub.secondary}</p>}
        {showTotalVacancies && (
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.18)", padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 800 }}>
            <span style={{ fontSize: 18 }}>👥</span>
            <span>{ar ? `إجمالي الشواغر: ${totalAuto}` : `Total Vacancies: ${totalAuto}`}</span>
          </div>
        )}
      </div>
    </div>
  );

  let header: React.ReactNode;
  if (style === "elegant") {
    header = (
      <div style={{ padding: "52px 44px 22px", borderBottom: `1px solid ${accent}33`, textAlign: "center", position: "relative" }}>
        {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 52, maxWidth: 150, objectFit: "contain", margin: "0 auto 16px", display: "block" }} />}
        <div style={{ width: 60, height: 2, background: accent, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 10, letterSpacing: 6, color: accent, marginBottom: 10 }}>{ar ? tag.ar : tag.en}</div>
        <h1 style={{ fontSize: 36, fontWeight: 300, margin: "0 0 4px", color: "#0f172a", letterSpacing: -0.5 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>{headerTitle.primary}</h1>
        {headerTitle.secondary && <div style={{ fontSize: 18, color: "#475569", fontWeight: 400 }} dir="ltr">{headerTitle.secondary}</div>}
        {headerSub.primary && <p style={{ fontSize: 14, color: "#64748b", margin: "8px 0 0", fontStyle: "italic" }}>{headerSub.primary}</p>}
        {headerSub.secondary && <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0", fontStyle: "italic" }} dir="ltr">{headerSub.secondary}</p>}
        {showTotalVacancies && <div style={{ marginTop: 14, fontSize: 12, color: accent, fontWeight: 700, letterSpacing: 2 }}>· {ar ? `${totalAuto} شاغر` : `${totalAuto} VACANCIES`} ·</div>}
        <div style={{ width: 60, height: 2, background: accent, margin: "20px auto 0" }} />
      </div>
    );
  } else if (style === "minimal") {
    header = (
      <div style={{ padding: "40px 36px 20px", display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid #e2e8f0` }}>
        {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 44, maxWidth: 110, objectFit: "contain" }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#64748b", marginBottom: 4 }}>{ar ? tag.ar : tag.en}</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: accent, lineHeight: 1.2 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>{headerTitle.primary}</h1>
          {headerTitle.secondary && <div style={{ fontSize: 14, color: "#64748b", marginTop: 2 }} dir="ltr">{headerTitle.secondary}</div>}
          {headerSub.primary && <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>{headerSub.primary}</p>}
        </div>
        {showTotalVacancies && (
          <div style={{ textAlign: "center", padding: "8px 14px", borderInlineStart: `3px solid ${accent}` }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: accent, lineHeight: 1 }}>{totalAuto}</div>
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{ar ? "شاغر" : "OPEN"}</div>
          </div>
        )}
      </div>
    );
  } else if (style === "luxury") {
    header = (
      <div style={{ background: "linear-gradient(135deg, #1a1a1a, #2d2419)", color: "#f5e6c8", padding: "48px 40px 40px", position: "relative", borderBottom: "3px solid #d4af37" }}>
        {logoUrl && <img src={logoUrl} alt="logo" style={{ position: "absolute", top: 20, [ar ? "right" : "left"]: 24, height: 50, maxWidth: 130, objectFit: "contain", filter: "brightness(1.1)" } as any} />}
        <div style={{ textAlign: "center", marginTop: logoUrl ? 36 : 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 8, color: "#d4af37", marginBottom: 14 }}>{ar ? tag.ar : tag.en}</div>
          <h1 style={{ fontSize: 38, fontWeight: 300, margin: 0, color: "#f5e6c8", letterSpacing: 1 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>{headerTitle.primary}</h1>
          {headerTitle.secondary && <div style={{ fontSize: 18, color: "#d4af37", fontWeight: 400, marginTop: 4, fontStyle: "italic" }} dir="ltr">{headerTitle.secondary}</div>}
          {headerSub.primary && <p style={{ fontSize: 13, color: "#e6d4a8", margin: "10px 0 0", opacity: 0.9 }}>{headerSub.primary}</p>}
          <div style={{ marginTop: 14, fontSize: 22, color: "#d4af37" }}>❖ ❖ ❖</div>
          {showTotalVacancies && <div style={{ marginTop: 8, fontSize: 12, color: "#d4af37", letterSpacing: 3, fontWeight: 700 }}>{ar ? `${totalAuto} شاغر` : `${totalAuto} POSITIONS`}</div>}
        </div>
      </div>
    );
  } else if (style === "corporate") {
    header = (
      <div style={{ padding: "32px 36px 24px", background: "white", borderBottom: `4px solid ${accent}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 50, maxWidth: 140, objectFit: "contain" }} />}
          <div style={{ background: accent, color: "white", padding: "6px 14px", fontSize: 10, fontWeight: 800, letterSpacing: 2 }}>{ar ? tag.ar : tag.en}</div>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "20px 0 4px", color: accent, lineHeight: 1.2 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>{headerTitle.primary}</h1>
        {headerTitle.secondary && <div style={{ fontSize: 16, color: "#475569", fontWeight: 600 }} dir="ltr">{headerTitle.secondary}</div>}
        {headerSub.primary && <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0" }}>{headerSub.primary}</p>}
        {showTotalVacancies && (
          <div style={{ marginTop: 12, display: "inline-block", padding: "4px 12px", background: `${accent}15`, color: accent, fontSize: 12, fontWeight: 800, borderRadius: 4 }}>
            {ar ? `إجمالي الشواغر: ${totalAuto}` : `Total Vacancies: ${totalAuto}`}
          </div>
        )}
      </div>
    );
  } else if (style === "creative") {
    header = (
      <div style={{ padding: "40px 36px 36px", background: `radial-gradient(circle at 20% 50%, ${accent}30, transparent), radial-gradient(circle at 80% 80%, ${secondary}30, transparent), white`, position: "relative" }}>
        {logoUrl && <img src={logoUrl} alt="logo" style={{ position: "absolute", top: 20, [ar ? "right" : "left"]: 24, height: 50, maxWidth: 130, objectFit: "contain" } as any} />}
        <div style={{ marginTop: logoUrl ? 30 : 0 }}>
          <div style={{ display: "inline-block", background: accent, color: "white", padding: "6px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700, marginBottom: 14, transform: "rotate(-2deg)" }}>
            {ar ? tag.ar : tag.en}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, margin: 0, color: accent, lineHeight: 1.05, letterSpacing: -1 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>{headerTitle.primary}</h1>
          {headerTitle.secondary && <div style={{ fontSize: 22, color: secondary, fontWeight: 700, marginTop: 4 }} dir="ltr">{headerTitle.secondary}</div>}
          {headerSub.primary && <p style={{ fontSize: 14, color: "#475569", margin: "10px 0 0" }}>{headerSub.primary}</p>}
          {showTotalVacancies && (
            <div style={{ marginTop: 14, display: "inline-flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: secondary }}>{totalAuto}</span>
              <span style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>{ar ? "فرصة في انتظارك" : "opportunities awaiting"}</span>
            </div>
          )}
        </div>
      </div>
    );
  } else if (style === "geometric") {
    header = (
      <div style={{ padding: "36px 36px 32px", background: `linear-gradient(135deg, ${accent} 0%, ${accent} 50%, ${secondary} 50%, ${secondary} 100%)`, color: textColor, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, [ar ? "left" : "right"]: 0, width: 120, height: 120, background: "rgba(255,255,255,0.15)", clipPath: "polygon(0 0, 100% 0, 100% 100%)" } as any} />
        <div style={{ position: "absolute", bottom: 0, [ar ? "right" : "left"]: 0, width: 80, height: 80, background: "rgba(0,0,0,0.15)", clipPath: "polygon(0 100%, 100% 0, 100% 100%)" } as any} />
        {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 46, maxWidth: 130, objectFit: "contain", background: "white", padding: 5, borderRadius: 6, marginBottom: 16 }} />}
        <div style={{ fontSize: 10, letterSpacing: 4, fontWeight: 800, marginBottom: 10, opacity: 0.9 }}>{ar ? tag.ar : tag.en}</div>
        <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, lineHeight: 1.1 }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>{headerTitle.primary}</h1>
        {headerTitle.secondary && <div style={{ fontSize: 18, opacity: 0.9, marginTop: 2 }} dir="ltr">{headerTitle.secondary}</div>}
        {headerSub.primary && <p style={{ fontSize: 13, opacity: 0.92, margin: "8px 0 0" }}>{headerSub.primary}</p>}
        {showTotalVacancies && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 800, background: "rgba(0,0,0,0.2)", padding: "5px 12px", borderRadius: 4, display: "inline-block" }}>◆ {totalAuto} {ar ? "شاغر" : "Open"}</div>}
      </div>
    );
  } else if (style === "gradient") {
    header = <HeroHeader big />;
  } else if (style === "magazine") {
    header = (
      <div style={{ padding: "28px 36px 24px", background: "white", borderBottom: `2px solid #0f172a` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: 12, marginBottom: 16 }}>
          {logoUrl ? <img src={logoUrl} alt="logo" style={{ height: 36, maxWidth: 110, objectFit: "contain" }} /> : <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4 }}>{ar ? "منصة التوظيف الذكية" : "NEXHIRE AI"}</div>}
          <div style={{ fontSize: 9, color: "#64748b", letterSpacing: 2 }}>{ar ? tag.ar : tag.en} · {new Date().getFullYear()}</div>
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 900, margin: 0, color: "#0f172a", lineHeight: 0.95, letterSpacing: -1.5, fontFamily: "Georgia, serif" }} dir={bilingualMode === "en" ? "ltr" : "rtl"}>{headerTitle.primary}</h1>
        {headerTitle.secondary && <div style={{ fontSize: 22, color: accent, fontWeight: 400, marginTop: 6, fontFamily: "Georgia, serif", fontStyle: "italic" }} dir="ltr">{headerTitle.secondary}</div>}
        {headerSub.primary && <p style={{ fontSize: 13, color: "#475569", margin: "10px 0 0", borderInlineStart: `3px solid ${accent}`, paddingInlineStart: 10 }}>{headerSub.primary}</p>}
        {showTotalVacancies && (
          <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", fontSize: 11, color: "#64748b" }}>
            <span><strong style={{ color: accent, fontSize: 16 }}>{totalAuto}</strong> {ar ? "شاغر" : "vacancies"}</span>
            <span>·</span>
            <span><strong style={{ color: accent, fontSize: 16 }}>{n}</strong> {ar ? "وظيفة" : "roles"}</span>
          </div>
        )}
      </div>
    );
  } else if (style === "bold") {
    header = <HeroHeader big />;
  } else if (style === "alkholi-official") {
    const hH = ak?.headerHeight ?? 150;
    const hPos = ak?.headerChevronPos ?? 45;
    const tFs = ak?.titleFontSize ?? 32;
    const padX = ak?.pagePaddingX ?? 40;
    const showChevron = !(headerImageUrl && hideHeaderChevron);
    const campLoc = ar ? (campaignLocationAr || campaignLocationEn) : (campaignLocationEn || campaignLocationAr);
    const campLocSecondary = ar ? campaignLocationEn : campaignLocationAr;
    header = (
      <div style={{ position: "relative", background: "white" }}>
        {/* Custom header image (above chevron) */}
        {headerImageUrl && (
          <div style={{ width: "100%", height: hH, overflow: "hidden", background: "#f1f5f9" }}>
            <img
              src={headerImageUrl}
              alt="Header"
              crossOrigin="anonymous"
              style={{
                width: "100%",
                height: "100%",
                objectFit: headerImgFit,
                objectPosition: `center ${headerImgPosY}%`,
                opacity: headerImgOpacity / 100,
                display: "block",
              }}
            />
          </div>
        )}
        {/* Navy chevron band */}
        {showChevron && (
          <div style={{ position: "relative", height: hH, background: accent, overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: `${hPos}%`, right: 0,
              background: "white",
              clipPath: "polygon(20% 0, 100% 0, 100% 100%, 20% 100%, 0 50%)",
            }} />
          </div>
        )}
        {/* Logo + website row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", padding: `20px ${padX}px 6px`, gap: 20 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: logoAlign === "center" ? "center" : logoAlign === "end" ? "flex-end" : "flex-start",
            gap: 10,
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: logoPadding,
              borderRadius: logoRadius,
              background: logoTransparentBg ? "transparent" : (logoUseCustomBg ? logoBgColor : "white"),
              transform: (logoOffsetX || logoOffsetY) ? `translate(${logoOffsetX}px, ${logoOffsetY}px)` : undefined,
            }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="NexHire AI"
                  crossOrigin="anonymous"
                  style={{
                    height: logoSize,
                    maxWidth: 260,
                    objectFit: "contain",
                    display: "block",
                    mixBlendMode: logoTransparentBg ? "multiply" : "normal",
                  }}
                />
              ) : (
                <BrandMark size={logoSize} aria-label="NexHire AI" />
              )}
            </div>
          </div>
          <div style={{ textAlign: "right", color: "#64748b", fontSize: 14, fontWeight: 500 }} dir="ltr">
            {qrUrl ? qrUrl.replace(/^https?:\/\//, "") : (ar ? "منصة التوظيف الذكية" : "NexHire AI")}
          </div>
        </div>
        {/* Dual title (alignment + offsets) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          padding: `6px ${padX}px 14px`,
          gap: 20,
          alignItems: "start",
          transform: (titleOffsetX || titleOffsetY) ? `translate(${titleOffsetX}px, ${titleOffsetY}px)` : undefined,
        }}>
          <div style={{ textAlign: titleAlignEn === "start" ? "left" : titleAlignEn === "end" ? "right" : "center" }} dir="ltr">
            <h1 style={{ fontSize: tFs, fontWeight: 800, margin: 0, color: accent, lineHeight: 1.05 }}>
              {titleEn || "Job Opportunities"}
            </h1>
            {subtitleEn ? (
              <div style={{ fontSize: Math.max(11, Math.round(tFs * 0.47)), color: "#475569", marginTop: 4, fontWeight: 500 }}>{subtitleEn}</div>
            ) : null}
          </div>
          <div style={{ textAlign: titleAlignAr === "end" ? "right" : titleAlignAr === "start" ? "left" : "center" }} dir="rtl">
            <h1 style={{ fontSize: tFs, fontWeight: 800, margin: 0, color: accent, lineHeight: 1.05, letterSpacing: 2 }}>
              {titleAr || "فـرص وظيـفـيـة"}
            </h1>
            {subtitleAr ? (
              <div style={{ fontSize: Math.max(11, Math.round(tFs * 0.47)), color: "#475569", marginTop: 4, fontWeight: 500 }}>{subtitleAr}</div>
            ) : null}
          </div>
        </div>
        {/* Campaign location pill */}
        {showCampaignLocation && (campaignLocationAr || campaignLocationEn) && (
          <div style={{ padding: `0 ${padX}px 6px`, display: "flex", justifyContent: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: accent, color: "white", padding: "6px 18px", borderRadius: 999,
              fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
            }}>
              <span>📍</span>
              <span>{campLoc}</span>
              {campLocSecondary && campLocSecondary !== campLoc && (
                <span style={{ opacity: 0.8, fontWeight: 500 }} dir={ar ? "ltr" : "rtl"}>· {campLocSecondary}</span>
              )}
            </div>
          </div>
        )}
        {showTotalVacancies && (
          <div style={{ padding: `0 ${padX}px 8px`, display: "flex", justifyContent: "center" }}>
            <div style={{ background: `${accent}10`, color: accent, padding: "5px 16px", borderRadius: 4, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>
              {ar ? `إجمالي الشواغر: ${totalAuto}` : `Total Vacancies: ${totalAuto}`}
            </div>
          </div>
        )}
      </div>
    );
  } else {
    header = <HeroHeader big />;
  }

  const isAlkholi = style === "alkholi-official";
  const akPadX = ak?.pagePaddingX ?? 40;
  const akPadTop = ak?.pagePaddingTop ?? 10;
  const akPadBot = ak?.pagePaddingBottom ?? 70;
  const akFootH = ak?.showFooterChevron ? (ak?.footerHeight ?? 60) : 0;
  const akFootPos = ak?.footerChevronPos ?? 50;
  const bodyPad = isAlkholi
    ? `${akPadTop}px ${akPadX}px ${akPadBot}px`
    : density === "ultra" ? "16px 28px 90px" : density === "tight" ? "20px 32px 90px" : "24px 36px 90px";

  return (
    <div style={containerStyle} className={isAlkholi ? "ak-page" : undefined}>
      {header}
      <div style={{ padding: bodyPad, marginTop: style === "modern" || style === "bold" || style === "gradient" ? -22 : 0 }}>
        {renderJobsByLayout()}
      </div>
      {isAlkholi ? (
        <>
          <div style={{
            position: "absolute",
            bottom: (ak?.showFooterChevron !== false ? akFootH : 0) + 6,
            left: 0, right: 0,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            color: accent,
            letterSpacing: 0.3,
            padding: "0 16px",
          }}>
            {ar
              ? `تاريخ النشر: ${new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}`
              : `Posted: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
          </div>
          {ak?.showFooterChevron !== false && !(footerImageUrl && hideFooterChevron) && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: akFootH, background: accent,
              clipPath: `polygon(0 50%, ${akFootPos}% 0, 100% 50%, 100% 100%, 0 100%)`,
            }} />
          )}
          {footerImageUrl && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: akFootH || 60, overflow: "hidden", pointerEvents: "none" }}>
              <img
                src={footerImageUrl}
                crossOrigin="anonymous"
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: footerImgFit,
                  objectPosition: `center ${footerImgPosY}%`,
                  opacity: footerImgOpacity / 100,
                  display: "block",
                }}
              />
            </div>
          )}
        </>
      ) : (
        <Footer accent={accent} secondary={secondary} ar={ar} showQr={showQr} qrUrl={qrUrl} totalVacancies={showTotalVacancies ? totalAuto : null} />
      )}
    </div>
  );
};

const CompactMeta = ({ job, ar, accent, fs = 10 }: { job: RenderJob; ar: boolean; accent: string; fs?: number }) => {
  const items: string[] = [];
  if (job.location) items.push(`📍 ${ar ? job.location : (job.location_en || job.location)}`);
  if (job.job_type) items.push(`💼 ${ar ? job.job_type : (job.job_type_en || job.job_type)}`);
  if (job.department) items.push(`🏢 ${ar ? job.department : (job.department_en || job.department)}`);
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", fontSize: fs, color: "#475569", marginTop: 3 }}>
      {items.map((t, i) => <span key={i}>{t}</span>)}
    </div>
  );
};

const Footer = ({ accent, secondary, ar, showQr, qrUrl, totalVacancies }: { accent: string; secondary: string; ar: boolean; showQr: boolean; qrUrl: string; totalVacancies: number | null }) => (
  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 36px", borderTop: `3px solid ${accent}`, background: "#f8fafc", fontSize: 11, color: "#475569", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
    <div>
      <div style={{ fontWeight: 800, color: accent, fontSize: 14 }}>{ar ? "منصة التوظيف الذكية" : "NexHire AI"}</div>
      <div style={{ fontSize: 10, marginTop: 2 }}>{ar ? "للتقديم امسح الباركود أو زر موقعنا" : "Scan QR or visit our website"}</div>
      <div style={{ fontSize: 9, marginTop: 2, color: secondary, fontWeight: 600 }}>
        {ar ? `تاريخ النشر: ${new Date().toLocaleDateString("ar-EG")}` : `Posted: ${new Date().toLocaleDateString("en-US")}`}
        {totalVacancies !== null && ` · ${ar ? `إجمالي ${totalVacancies} شاغر` : `${totalVacancies} total openings`}`}
      </div>
    </div>
    {showQr && qrUrl && (
      <div style={{ background: "white", padding: 6, borderRadius: 8, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", gap: 8 }}>
        <QRCodeSVG value={qrUrl} size={62} />
        <div style={{ fontSize: 10, color: "#475569", maxWidth: 80, lineHeight: 1.3, fontWeight: 600 }}>
          {ar ? "امسح للتقديم" : "Scan to apply"}
        </div>
      </div>
    )}
  </div>
);

export default JobAdvertisements;
