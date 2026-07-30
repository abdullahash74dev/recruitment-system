import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useLanguage } from "@/contexts/LanguageContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VideoProvider = "google_meet" | "zoom" | "teams" | "custom";
export type VideoSessionStatus = "scheduled" | "live" | "completed" | "cancelled" | "no_show";

export interface VideoMeetingSettings {
  id: string;
  provider: VideoProvider;
  default_duration_minutes: number | null;
  auto_generate_link: boolean | null;
  /** Only meaningful for provider="custom"; may contain an `{id}` token. */
  custom_link_pattern: string | null;
  is_active: boolean | null;
  updated_at: string;
  created_at: string;
}

export interface VideoSession {
  id: string;
  interview_id: string | null;
  applicant_id: string | null;
  applicant_name: string | null;
  provider: VideoProvider;
  meeting_link: string;
  meeting_id: string | null;
  passcode: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: VideoSessionStatus;
  recording_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateVideoSessionInput {
  applicant_name: string;
  scheduled_at: string;
  provider: VideoProvider;
  duration_minutes?: number | null;
  /** Paste a real link here to skip generation entirely. */
  meeting_link?: string | null;
  meeting_id?: string | null;
  passcode?: string | null;
  notes?: string | null;
  applicant_id?: string | null;
  interview_id?: string | null;
}

export interface UpdateVideoSessionInput {
  id: string;
  patch: Partial<Omit<VideoSession, "id" | "created_at" | "created_by">>;
}

// ---------------------------------------------------------------------------
// Meeting link generation
// ---------------------------------------------------------------------------

/**
 * Provider "start a meeting" entry points.
 *
 * IMPORTANT: these are *not* per-candidate rooms. Creating a genuine pre-booked
 * meeting — a fixed Meet code, a Zoom meeting id + passcode, a Teams join URL —
 * requires a server-side OAuth exchange with the provider (Google Calendar API
 * `conferenceData`, Zoom `POST /users/me/meetings`, Microsoft Graph
 * `POST /me/onlineMeetings`) using client credentials / refresh tokens that must
 * never be shipped to the browser. Until those credentials are configured in an
 * edge function, this is the manual-link fallback: the recruiter gets a link
 * that opens the provider and can paste the real room URL over it, so
 * scheduling is never blocked on the integration being finished.
 */
const PROVIDER_START_LINK: Record<VideoProvider, string> = {
  google_meet: "https://meet.google.com/new",
  zoom: "https://zoom.us/start/videomeeting",
  teams: "https://teams.microsoft.com/l/meetup-join/",
  // Resolved from settings.custom_link_pattern — no sensible default exists.
  custom: "",
};

/** Short, human-quotable reference stored alongside the link. */
function generateMeetingId(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 2 || i === 6) out += "-";
  }
  return out;
}

/**
 * Builds the fallback link for a provider. `custom` substitutes the generated
 * meeting id into the configured pattern (`{id}` token, or appended when the
 * pattern is a bare base URL).
 */
function buildMeetingLink(
  provider: VideoProvider,
  meetingId: string,
  settings: VideoMeetingSettings | null
): string {
  if (provider !== "custom") return PROVIDER_START_LINK[provider];

  const pattern = (settings?.custom_link_pattern ?? "").trim();
  if (!pattern) return "";
  if (pattern.includes("{id}")) return pattern.replace(/\{id\}/g, meetingId);
  return pattern.endsWith("/") ? `${pattern}${meetingId}` : `${pattern}/${meetingId}`;
}

/**
 * Settings are needed by the create mutation but are usually already cached by
 * the module screen — read the cache first and only hit the network when the
 * mutation runs on a screen that never mounted the settings query.
 */
async function resolveSettings(queryClient: QueryClient): Promise<VideoMeetingSettings | null> {
  const cached = queryClient.getQueryData<VideoMeetingSettings | null>(queryKeys.videoInterviews.settings());
  if (cached !== undefined) return cached;

  const { data, error } = await (supabase as any)
    .from("video_meeting_settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] ?? null) as VideoMeetingSettings | null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Settings are a single logical row — we always read the most recent one. */
export function useVideoSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.videoInterviews.settings(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("video_meeting_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as VideoMeetingSettings | null;
    },
  });
}

export function useUpsertVideoSettingsMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (payload: Partial<VideoMeetingSettings>) => {
      const patch: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
      delete patch.created_at;

      if (payload.id) {
        const { error } = await (supabase as any)
          .from("video_meeting_settings")
          .update(patch)
          .eq("id", payload.id);
        if (error) throw error;
        return;
      }
      delete patch.id;
      const { error } = await (supabase as any).from("video_meeting_settings").insert(patch);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videoInterviews.all });
      toast.success(ar ? "تم حفظ إعدادات الاجتماعات" : "Meeting settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function useVideoSessionsQuery() {
  return useQuery({
    queryKey: queryKeys.videoInterviews.sessions(),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("video_sessions")
        .select("*")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VideoSession[];
    },
  });
}

export function useCreateVideoSessionMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (input: CreateVideoSessionInput) => {
      const manualLink = (input.meeting_link ?? "").trim();
      const meetingId = (input.meeting_id ?? "").trim() || generateMeetingId();

      let link = manualLink;
      if (!link) {
        const settings = await resolveSettings(queryClient);

        if (settings && settings.auto_generate_link === false) {
          throw new Error(
            ar
              ? "التوليد التلقائي للروابط معطّل في الإعدادات — الصق رابط الاجتماع يدوياً."
              : "Automatic link generation is disabled in settings — paste a meeting link manually."
          );
        }

        link = buildMeetingLink(input.provider, meetingId, settings);

        if (!link) {
          throw new Error(
            ar
              ? "لا يوجد نمط رابط مخصّص في الإعدادات — أضِف النمط أو الصق رابط الاجتماع يدوياً."
              : "No custom link pattern is configured — set one in settings or paste a meeting link manually."
          );
        }
      }

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await (supabase as any).from("video_sessions").insert({
        interview_id: input.interview_id ?? null,
        applicant_id: input.applicant_id ?? null,
        applicant_name: input.applicant_name.trim() || null,
        provider: input.provider,
        meeting_link: link,
        meeting_id: meetingId,
        passcode: (input.passcode ?? "").trim() || null,
        scheduled_at: input.scheduled_at,
        duration_minutes: input.duration_minutes ?? 45,
        status: "scheduled",
        notes: (input.notes ?? "").trim() || null,
        created_by: userData?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videoInterviews.all });
      toast.success(ar ? "تم جدولة المقابلة" : "Video session scheduled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateVideoSessionMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateVideoSessionInput) => {
      const { error } = await (supabase as any).from("video_sessions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videoInterviews.all });
      toast.success(ar ? "تم تحديث الجلسة" : "Session updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteVideoSessionMutation() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const ar = lang === "ar";

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("video_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videoInterviews.all });
      toast.success(ar ? "تم حذف الجلسة" : "Session deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
