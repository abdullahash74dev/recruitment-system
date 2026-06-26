import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

interface Props {
  path: string | null;
  alt?: string;
  className?: string;
}

async function fetchSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("resumes").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/**
 * Displays an image that may be a data URI, full URL, or a private storage path.
 * For storage paths, it fetches a signed URL automatically, cached by path
 * (shared with any other place rendering the same file) since signed URLs
 * stay valid for an hour.
 */
const StorageImage = ({ path, alt = "", className = "" }: Props) => {
  const isDirect = !!path && (path.startsWith("data:") || path.startsWith("http"));
  const { data: signedUrl } = useQuery(
    {
      queryKey: queryKeys.storage.signedUrl(path || ""),
      queryFn: () => fetchSignedUrl(path as string),
      enabled: !!path && !isDirect,
      staleTime: 30 * 60 * 1000,
      placeholderData: keepPreviousData,
    },
    queryClient,
  );

  const src = !path ? null : isDirect ? path : signedUrl;
  if (!src) return null;

  return <img src={src} alt={alt} className={className} onError={(e) => (e.currentTarget.style.display = "none")} />;
};

export default StorageImage;
