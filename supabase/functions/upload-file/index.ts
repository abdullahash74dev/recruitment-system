import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

type AllowedExtension = "pdf" | "jpg" | "jpeg" | "png" | "doc" | "docx";

const ALLOWED_EXTENSIONS: AllowedExtension[] = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
const MIME_TO_EXTENSION: Record<string, AllowedExtension> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "image/png": "png",
};

const MAGIC_BYTES: Record<AllowedExtension, { bytes: number[]; offset: number }[]> = {
  pdf: [{ bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }],
  jpg: [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }],
  jpeg: [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }],
  png: [{ bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 }],
  doc: [{ bytes: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],
  docx: [{ bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 }],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

const FILE_KIND_TO_COLUMN: Record<string, string> = {
  resume: "resume_url",
  degree: "degree_url",
  training: "training_certs_url",
  other: "other_docs_url",
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeString(value: FormDataEntryValue | null, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validateMagicBytes(buffer: Uint8Array, extension: AllowedExtension): boolean {
  const signatures = MAGIC_BYTES[extension];
  return signatures.some((sig) =>
    sig.bytes.every((b, i) => buffer[sig.offset + i] === b)
  );
}

function detectExtension(file: File, buffer: Uint8Array): AllowedExtension | "" {
  const fileNameExtension = file.name.split(".").pop()?.toLowerCase() || "";
  if (ALLOWED_EXTENSIONS.includes(fileNameExtension as AllowedExtension)) {
    return fileNameExtension as AllowedExtension;
  }

  const mimeExtension = MIME_TO_EXTENSION[file.type.toLowerCase()];
  if (mimeExtension) {
    return mimeExtension;
  }

  return ALLOWED_EXTENSIONS.find((extension) => validateMagicBytes(buffer, extension)) || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "uploads";
    const applicantId = safeString(formData.get("applicantId"), 80);
    const submissionToken = safeString(formData.get("submissionToken"), 256);
    const kind = safeString(formData.get("kind"), 30) || "resume";

    if (!applicantId || !/^[0-9a-f-]{36}$/i.test(applicantId) || !submissionToken || !FILE_KIND_TO_COLUMN[kind]) {
      return new Response(JSON.stringify({ error: "Valid application upload token is required." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await sha256Hex(submissionToken);
    const { data: applicant, error: applicantError } = await supabase
      .from("applicants")
      .select("id, submission_token_hash, created_at, updated_at")
      .eq("id", applicantId)
      .maybeSingle();

    const tokenTimestamp = new Date(applicant?.updated_at || applicant?.created_at || 0).getTime();
    if (
      applicantError ||
      !applicant ||
      applicant.submission_token_hash !== tokenHash ||
      Number.isNaN(tokenTimestamp) ||
      Date.now() - tokenTimestamp > TOKEN_MAX_AGE_MS
    ) {
      return new Response(JSON.stringify({ error: "Upload token expired or invalid." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size === 0) {
      return new Response(
        JSON.stringify({
          error: "The selected file is empty or unreadable. Please choose the original file and try again.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum size is 10 MB." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) || "uploads";
    const arrayBuffer = await file.arrayBuffer();
    const header = new Uint8Array(arrayBuffer.slice(0, 16));
    const ext = detectExtension(file, header);

    if (!ext) {
      return new Response(
        JSON.stringify({ error: "File type is not allowed." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!validateMagicBytes(header, ext)) {
      return new Response(
        JSON.stringify({ error: "File content does not match its extension." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const uniqueId = crypto.randomUUID();
    const path = `${safeFolder}/${applicantId}/${uniqueId}.${ext}`;

    const { error } = await supabase.storage.from("resumes").upload(path, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (error) {
      console.error("Storage upload error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to upload file" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabase
      .from("applicants")
      .update({ [FILE_KIND_TO_COLUMN[kind]]: path })
      .eq("id", applicantId)
      .eq("submission_token_hash", tokenHash);

    if (updateError) {
      console.error("Applicant file link update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to attach uploaded file to application" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return new Response(JSON.stringify({ error: "Upload failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});