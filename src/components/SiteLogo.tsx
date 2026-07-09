import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import BrandMark from "@/components/BrandMark";

interface LogoData {
  logo_url: string | null;
  logo_height: string | null;
  logo_width: number | null;
  logo_padding: number | null;
  logo_bg_color: string | null;
  logo_bg_enabled: boolean | null;
  logo_border_radius: string | null;
  logo_shadow: boolean | null;
  logo_border: boolean | null;
  logo_rotation: number | null;
  logo_offset_x: number | null;
  logo_offset_y: number | null;
  logo_fit: string | null;
  // mobile overrides
  logo_height_mobile: number | null;
  logo_width_mobile: number | null;
  logo_padding_mobile: number | null;
  logo_bg_color_mobile: string | null;
  logo_border_radius_mobile: string | null;
  site_name_ar: string | null;
  site_name_en: string | null;
}

// Shares queryKeys.siteSettings.all with useSiteSettings/useSiteContent — all
// three read the exact same site_settings row, so every <SiteLogo/> on a page
// (header, sidebar, footer...) plus those hooks now cost one fetch, not N.
async function fetchLogoRow(): Promise<LogoData | null> {
  const { data } = await supabase.from("site_settings").select("*").limit(1).single();
  return data ? (data as any) : null;
}

export const refreshSiteLogo = () => queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings.all });

interface Props {
  alt?: string;
  className?: string;
  /** Override desktop height (px) */
  heightOverride?: number;
}

export const SiteLogo = ({ alt = "Logo", className = "", heightOverride }: Props) => {
  // Bound directly to the singleton queryClient (not context) so this shares
  // the cache with useSiteSettings/useSiteContent even outside a
  // QueryClientProvider (e.g. in tests).
  const { data: queryData } = useQuery({ queryKey: queryKeys.siteSettings.all, queryFn: fetchLogoRow }, queryClient);
  const data = queryData ?? null;
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const url = data?.logo_url || null;
  const desktopH = heightOverride ?? parseInt(data?.logo_height || "56") ?? 56;
  const mobileH = data?.logo_height_mobile ?? Math.max(32, Math.round(desktopH * 0.75));
  const h = isMobile ? mobileH : desktopH;

  const desktopW = data?.logo_width ?? null;
  const mobileW = data?.logo_width_mobile ?? desktopW;
  const w = isMobile ? mobileW : desktopW;

  const padding = isMobile
    ? (data?.logo_padding_mobile ?? data?.logo_padding ?? 0)
    : (data?.logo_padding ?? 0);

  const bg = isMobile
    ? (data?.logo_bg_color_mobile ?? data?.logo_bg_color)
    : data?.logo_bg_color;

  const radius = isMobile
    ? (data?.logo_border_radius_mobile ?? data?.logo_border_radius ?? "8")
    : (data?.logo_border_radius ?? "8");

  const altName = alt || data?.site_name_ar || data?.site_name_en || "Logo";

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${padding}px`,
        borderRadius: `${parseInt(String(radius)) || 0}px`,
        background: bg || (data?.logo_bg_enabled ? "rgba(255,255,255,0.9)" : "transparent"),
        boxShadow: data?.logo_shadow ? "0 8px 24px -8px rgba(0,0,0,0.25)" : undefined,
        border: data?.logo_border ? "1px solid hsl(var(--border))" : undefined,
        transform: `translate(${data?.logo_offset_x ?? 0}px, ${data?.logo_offset_y ?? 0}px) rotate(${data?.logo_rotation ?? 0}deg)`,
        transition: "all 0.2s ease",
      }}
    >
      {url ? (
        <img
          src={url}
          alt={altName}
          style={{
            height: `${h}px`,
            width: w ? `${w}px` : "auto",
            objectFit: (data?.logo_fit as any) || "contain",
            display: "block",
          }}
        />
      ) : (
        <BrandMark size={h} aria-label={altName} />
      )}
    </div>
  );
};

export default SiteLogo;
