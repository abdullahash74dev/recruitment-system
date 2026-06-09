import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  path: string | null;
  alt?: string;
  className?: string;
}

/**
 * Displays an image that may be a data URI, full URL, or a private storage path.
 * For storage paths, it fetches a signed URL automatically.
 */
const StorageImage = ({ path, alt = "", className = "" }: Props) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setSrc(null); return; }

    // Data URI or full URL — use directly
    if (path.startsWith("data:") || path.startsWith("http")) {
      setSrc(path);
      return;
    }

    // Private storage path — get signed URL
    let cancelled = false;
    supabase.storage.from("resumes").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setSrc(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);

  if (!src) return null;

  return <img src={src} alt={alt} className={className} onError={(e) => (e.currentTarget.style.display = "none")} />;
};

export default StorageImage;
