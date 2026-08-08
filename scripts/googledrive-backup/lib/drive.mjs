const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { retries = 4 } = {}) {
  let attempt = 0;
  for (;;) {
    const res = await fn();
    if (res.status !== 429 && res.status !== 500 && res.status !== 503) return res;
    if (attempt >= retries) return res;
    await sleep(2 ** attempt * 1000);
    attempt += 1;
  }
}

function escapeForQuery(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const folderCache = new Map();

async function findFolder(accessToken, name, parentId) {
  const q = encodeURIComponent(
    `name='${escapeForQuery(name)}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const res = await withRetry(() =>
    fetch(`${DRIVE_BASE}/files?q=${q}&fields=files(id)`, { headers: { Authorization: `Bearer ${accessToken}` } })
  );
  if (!res.ok) throw new Error(`Folder lookup failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

/** Finds (or creates) a folder by name under `parentId` ("root" for My Drive root). Cached per script run. */
export async function ensureFolder(accessToken, name, parentId = "root") {
  const cacheKey = `${parentId}/${name}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

  const existingId = await findFolder(accessToken, name, parentId);
  if (existingId) {
    folderCache.set(cacheKey, existingId);
    return existingId;
  }

  const createRes = await withRetry(() =>
    fetch(`${DRIVE_BASE}/files?fields=id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    })
  );
  if (!createRes.ok) throw new Error(`Folder creation failed (${createRes.status}): ${await createRes.text()}`);
  const created = await createRes.json();
  folderCache.set(cacheKey, created.id);
  return created.id;
}

/** Ensures a nested "a/b/c" path exists under My Drive root, returns the deepest folder's id. */
export async function ensureFolderPath(accessToken, segments) {
  let parentId = "root";
  for (const segment of segments) {
    parentId = await ensureFolder(accessToken, segment, parentId);
  }
  return parentId;
}

async function findFile(accessToken, folderId, filename) {
  const q = encodeURIComponent(`name='${escapeForQuery(filename)}' and '${folderId}' in parents and trashed=false`);
  const res = await withRetry(() =>
    fetch(`${DRIVE_BASE}/files?q=${q}&fields=files(id)`, { headers: { Authorization: `Bearer ${accessToken}` } })
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

/**
 * Uploads (or, if a file with the same name already exists in that folder,
 * overwrites in place) a file via a resumable upload session -- works for
 * any file size, not just the small-file simple-upload limit.
 */
export async function uploadFile(accessToken, folderId, filename, buffer, mimeType = "application/octet-stream") {
  const existingId = await findFile(accessToken, folderId, filename);
  const sessionUrl = existingId
    ? `${UPLOAD_BASE}/files/${existingId}?uploadType=resumable&fields=id,webViewLink,size`
    : `${UPLOAD_BASE}/files?uploadType=resumable&fields=id,webViewLink,size`;

  const sessionRes = await withRetry(() =>
    fetch(sessionUrl, {
      method: existingId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
      },
      body: existingId ? undefined : JSON.stringify({ name: filename, parents: [folderId] }),
    })
  );
  if (!sessionRes.ok) {
    throw new Error(`createUploadSession failed (${sessionRes.status}): ${await sessionRes.text()}`);
  }
  const uploadUrl = sessionRes.headers.get("location");
  if (!uploadUrl) throw new Error("Google Drive did not return an upload session URL");

  const uploadRes = await withRetry(() =>
    fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Length": String(buffer.length), "Content-Type": mimeType },
      body: buffer,
    })
  );
  if (!uploadRes.ok) {
    throw new Error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
  }
  const item = await uploadRes.json();
  return { id: item.id, webUrl: item.webViewLink, size: Number(item.size || buffer.length) };
}

export async function getMyEmail(accessToken) {
  const res = await withRetry(() =>
    fetch(`${DRIVE_BASE}/about?fields=user`, { headers: { Authorization: `Bearer ${accessToken}` } })
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user?.emailAddress || null;
}
