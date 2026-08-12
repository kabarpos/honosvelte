/**
 * Minimal tus v1 client (protocol matched by src/server/routes/uploads.routes.ts).
 * Shared by pages that upload files straight to the tus endpoint before
 * linking them through a feature route (see /settings/media).
 */
const CHUNK_SIZE = 256 * 1024;
const TUS_RESUMABLE = "1.0.0";

function toBase64(s: string): string {
	const bytes = new TextEncoder().encode(s);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

/**
 * Create a tus upload for `file` (resuming from the server offset when the
 * upload id already exists) and stream its bytes in chunks. Resolves with
 * the upload id once the upload is complete.
 */
export async function tusUpload(
	id: string,
	file: File,
	onProgress?: (percent: number) => void,
): Promise<string> {
	let uploadId = id;
	if (!uploadId) {
		const type =
			file.type ||
			(file.name.toLowerCase().endsWith(".ico")
				? "image/x-icon"
				: "application/octet-stream");
		const create = await fetch("/uploads", {
			method: "POST",
			headers: {
				"Tus-Resumable": TUS_RESUMABLE,
				"Upload-Length": String(file.size),
				"Upload-Metadata": `filename ${toBase64(file.name)},filetype ${toBase64(type)}`,
			},
		});
		if (!create.ok)
			throw new Error(`Upload could not be created (HTTP ${create.status})`);
		const location = create.headers.get("Location");
		if (!location) throw new Error("Server did not return an upload URL");
		uploadId = location.split("/").pop() ?? "";
	}

	// Reconcile the offset so an interrupted upload resumes where it stopped.
	const head = await fetch(`/uploads/${uploadId}`, {
		method: "HEAD",
		headers: { "Tus-Resumable": TUS_RESUMABLE },
	});
	let offset = 0;
	if (head.ok) {
		const h = head.headers.get("Upload-Offset");
		offset = h ? Number(h) || 0 : 0;
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	while (offset < bytes.byteLength) {
		const end = Math.min(offset + CHUNK_SIZE, bytes.byteLength);
		const res = await fetch(`/uploads/${uploadId}`, {
			method: "PATCH",
			headers: {
				"Tus-Resumable": TUS_RESUMABLE,
				"Content-Type": "application/offset+octet-stream",
				"Upload-Offset": String(offset),
			},
			body: bytes.slice(offset, end),
		});
		if (!res.ok)
			throw new Error(`Upload failed (HTTP ${res.status})`);
		offset = end;
		onProgress?.(Math.round((offset / bytes.byteLength) * 100));
	}
	return uploadId;
}
