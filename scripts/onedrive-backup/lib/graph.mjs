const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { retries = 4 } = {}) {
  let attempt = 0;
  for (;;) {
    const res = await fn();
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt >= retries) return res;
    const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
    await sleep(retryAfter * 1000);
    attempt += 1;
  }
}

function encodeGraphPath(remotePath) {
  return remotePath.split("/").map(encodeURIComponent).join("/");
}

/**
 * Uploads a file to the signed-in account's OneDrive at `remotePath` (e.g.
 * "RecruitmentBackups/resume/<applicant-id>/cv.pdf"), creating any missing
 * intermediate folders automatically (Graph's path-addressing does this).
 * Uses a resumable upload session so it works for any résumé size, not
 * just the <4MB Graph allows for a single PUT.
 */
export async function uploadFile(accessToken, remotePath, buffer) {
  const encodedPath = encodeGraphPath(remotePath);

  const sessionRes = await withRetry(() =>
    fetch(`${GRAPH_BASE}/me/drive/root:/${encodedPath}:/createUploadSession`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
    })
  );
  if (!sessionRes.ok) {
    throw new Error(`createUploadSession failed (${sessionRes.status}): ${await sessionRes.text()}`);
  }
  const { uploadUrl } = await sessionRes.json();

  const uploadRes = await withRetry(() =>
    fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(buffer.length),
        "Content-Range": `bytes 0-${buffer.length - 1}/${buffer.length}`,
      },
      body: buffer,
    })
  );
  if (!uploadRes.ok) {
    throw new Error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
  }
  const item = await uploadRes.json();
  return { id: item.id, webUrl: item.webUrl, size: item.size };
}

export async function getMyDisplayName(accessToken) {
  const res = await withRetry(() =>
    fetch(`${GRAPH_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.userPrincipalName || data?.mail || null;
}
