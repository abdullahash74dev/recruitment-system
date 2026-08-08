import "dotenv/config";
import { getAccessToken } from "./lib/googleAuth.mjs";
import { ensureFolderPath, uploadFile, getMyEmail } from "./lib/drive.mjs";
import { createSupabaseAdmin } from "./lib/supabaseAdmin.mjs";

/**
 * Copies applicant documents out of Supabase Storage into the operator's
 * own Google Drive, and (optionally) a full JSON export of the applicants
 * table -- an independent, self-owned copy of the data that survives even
 * if access to this Supabase project is ever lost. Sibling of
 * scripts/onedrive-backup -- same commands, same external_backups tracking
 * table, distinguished by destination="googledrive" so both can run
 * side by side without interfering with each other.
 *
 * Usage:
 *   node backup.mjs             upload everything not yet backed up
 *   node backup.mjs --status    list what's missing, upload nothing
 *   node backup.mjs --dry-run   count what's missing, upload nothing
 *   node backup.mjs --limit=50  cap this run to N files (for a first test)
 *   node backup.mjs --export-data   also export+upload the full applicants table as JSON
 */

const KIND_TO_COLUMN = {
  resume: "resume_url",
  degree: "degree_url",
  training: "training_certs_url",
  other: "other_docs_url",
};

const MIME_BY_EXT = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isStatusOnly = args.includes("--status");
const exportData = args.includes("--export-data");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

const rootFolder = process.env.GDRIVE_ROOT_FOLDER || "RecruitmentBackups";
const kinds = (process.env.BACKUP_FILE_KINDS || "resume")
  .split(",")
  .map((s) => s.trim())
  .filter((k) => KIND_TO_COLUMN[k]);

function basename(p) {
  return p.split("/").pop() || "file";
}

function guessMime(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

async function main() {
  if (kinds.length === 0) {
    throw new Error("BACKUP_FILE_KINDS in .env has no valid entries (resume, degree, training, other).");
  }

  const supabase = createSupabaseAdmin();

  console.log(`Fetching applicants (kinds: ${kinds.join(", ")})...`);
  const columns = ["id", "full_name", ...kinds.map((k) => KIND_TO_COLUMN[k])];
  const { data: applicants, error } = await supabase.from("applicants").select(columns.join(", "));
  if (error) throw error;

  const { data: existingBackups, error: backupsError } = await supabase
    .from("external_backups")
    .select("applicant_id, file_kind, status")
    .eq("destination", "googledrive");
  if (backupsError) throw backupsError;

  const doneSet = new Set(
    (existingBackups || []).filter((b) => b.status === "success").map((b) => `${b.applicant_id}:${b.file_kind}`)
  );

  let totalCandidates = 0;
  const pending = [];
  for (const applicant of applicants || []) {
    for (const kind of kinds) {
      const filePath = applicant[KIND_TO_COLUMN[kind]];
      if (!filePath) continue;
      totalCandidates += 1;
      if (doneSet.has(`${applicant.id}:${kind}`)) continue;
      pending.push({ applicantId: applicant.id, fullName: applicant.full_name, kind, path: filePath });
    }
  }

  console.log(`${totalCandidates} file(s) total, ${pending.length} not yet backed up to Google Drive.`);

  if (isStatusOnly) {
    for (const p of pending.slice(0, 50)) {
      console.log(`  - [${p.kind}] ${p.fullName || p.applicantId} -> ${p.path}`);
    }
    if (pending.length > 50) console.log(`  ...and ${pending.length - 50} more`);
    return;
  }

  if (isDryRun) {
    console.log("Dry run -- no files uploaded.");
    return;
  }

  if (pending.length === 0 && !exportData) {
    console.log("Nothing to do.");
    return;
  }

  const accessToken = await getAccessToken();
  const who = await getMyEmail(accessToken);
  console.log(`Uploading to Google Drive account: ${who || "(unknown)"}\n`);

  const batch = pending.slice(0, limit);
  let done = 0;
  let failed = 0;

  for (const item of batch) {
    const label = `[${item.kind}] ${item.fullName || item.applicantId}`;
    try {
      const { data: fileBlob, error: downloadError } = await supabase.storage.from("resumes").download(item.path);
      if (downloadError || !fileBlob) throw downloadError || new Error("Downloaded file was empty");
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      const filename = basename(item.path);
      const folderId = await ensureFolderPath(accessToken, [rootFolder, item.kind, item.applicantId]);
      const uploaded = await uploadFile(accessToken, folderId, filename, buffer, guessMime(filename));

      await supabase.from("external_backups").upsert(
        {
          applicant_id: item.applicantId,
          file_kind: item.kind,
          supabase_path: item.path,
          destination: "googledrive",
          external_item_id: uploaded.id,
          external_web_url: uploaded.webUrl,
          file_size: uploaded.size,
          status: "success",
          error_message: null,
          backed_up_at: new Date().toISOString(),
        },
        { onConflict: "applicant_id,file_kind,destination" }
      );
      done += 1;
      console.log(`OK   ${label}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${label}: ${err.message || err}`);
      await supabase.from("external_backups").upsert(
        {
          applicant_id: item.applicantId,
          file_kind: item.kind,
          supabase_path: item.path,
          destination: "googledrive",
          status: "error",
          error_message: String(err.message || err).slice(0, 500),
          backed_up_at: new Date().toISOString(),
        },
        { onConflict: "applicant_id,file_kind,destination" }
      );
    }
  }

  const remaining = pending.length - batch.length;
  console.log(
    `\nDone. Uploaded: ${done}, Failed: ${failed}, Already backed up: ${totalCandidates - pending.length}` +
      (remaining > 0 ? `, Remaining (run again to continue): ${remaining}` : "")
  );

  if (exportData) {
    console.log("\nExporting full applicants table as JSON...");
    const { data: allApplicants, error: exportError } = await supabase.from("applicants").select("*");
    if (exportError) throw exportError;
    const json = JSON.stringify(allApplicants, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `applicants-${dateStr}.json`;
    const folderId = await ensureFolderPath(accessToken, [rootFolder, "data-exports"]);
    const uploaded = await uploadFile(accessToken, folderId, filename, Buffer.from(json, "utf-8"), "application/json");
    await supabase.from("external_backups").insert({
      applicant_id: null,
      file_kind: "data_export",
      supabase_path: null,
      destination: "googledrive",
      external_item_id: uploaded.id,
      external_web_url: uploaded.webUrl,
      file_size: uploaded.size,
      status: "success",
    });
    console.log(`Exported ${allApplicants.length} applicant record(s) -> ${uploaded.webUrl}`);
  }
}

main().catch((err) => {
  console.error("Backup run failed:", err.message || err);
  process.exit(1);
});
