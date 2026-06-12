import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAI } from "../_shared/ai-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isHr } = await adminClient.rpc("is_admin_or_hr", { _user_id: u.user.id });
    if (!isHr) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large. Maximum size is 10 MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file type - only PDF allowed for parsing
    const ext = file.name?.split(".").pop()?.toLowerCase() || "";
    if (ext !== "pdf") {
      return new Response(JSON.stringify({ error: "Only PDF files can be parsed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = file.type || "application/pdf";

    const aiResult = await callAI({
      service: "parse-resume",
      model: "google/gemini-2.5-flash",
      userId: u.user.id,
      userEmail: u.user.email,
      body: {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the following information from this resume/CV document. Return ONLY a valid JSON object with these exact keys (use empty string "" if not found):

{
  "fullName": "full name",
  "gender": "ذكر or أنثى",
  "nationality": "nationality in Arabic",
  "birthDate": "YYYY-MM-DD format if found",
  "maritalStatus": "أعزب/عزباء or متزوج/ة or مطلق/ة or أرمل/ة",
  "phone": "phone number",
  "email": "email address",
  "currentCity": "city in Arabic",
  "educationLevel": "education level in Arabic (ثانوية, دبلوم, بكالوريوس, ماجستير, دكتوراه)",
  "major": "field of study",
  "university": "university name",
  "graduationYear": "year",
  "gpa": "GPA if found",
  "yearsExperience": "years of experience as Arabic text",
  "currentTitle": "current job title",
  "currentTasks": "brief summary of current tasks",
  "selfSummary": "professional summary",
  "otherExperience": "other experience",
  "arabicLevel": "ممتاز, جيد جداً, جيد, متوسط, or مبتدئ",
  "englishLevel": "ممتاز, جيد جداً, جيد, متوسط, or مبتدئ",
  "otherLanguage": "other languages",
  "linkedin": "LinkedIn URL if found"
}

Return ONLY the JSON, no markdown, no explanation.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 2000,
      },
    });

    if (!aiResult.ok) {
      console.error("AI error:", aiResult.status, aiResult.errorText);
      if (aiResult.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResult.status === 429) return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Failed to parse resume" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = aiResult.data?.choices?.[0]?.message?.content || "{}";
    let jsonStr = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Parse resume error:", error);
    return new Response(JSON.stringify({ error: "Failed to parse resume" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
