/**
 * On-disk storage for tus upload bytes. Files live at `<UPLOAD_DIR>/<id>`,
 * created lazily on the first PATCH (or on POST when creation-with-upload
 * sends a body). Appending is done with `node:fs/promises` `appendFile`.
 */
import { appendFile, writeFile } from "node:fs/promises";
import {
	mkdirSync as mkdirSyncSync,
	rmSync as rmSyncSync,
	statSync as statSyncSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { config } from "./config";

const uploadDir = resolve(config.upload.dir);
mkdirSyncSync(uploadDir, { recursive: true });

/** Absolute path on disk for a given upload id. */
export function uploadPath(id: string): string {
	// Reject any traversal attempts in the id (ids are server-generated, but
	// defence in depth).
	if (!/^[A-Za-z0-9_-]{1,64}$/.test(id))
		throw new Error(`Invalid upload id: ${id}`);
	return join(uploadDir, id);
}

/** Append a Buffer/Uint8Array to the upload file. Returns bytes written. */
export async function appendBytes(
	id: string,
	data: Uint8Array,
): Promise<number> {
	await appendFile(uploadPath(id), data);
	return data.byteLength;
}

/**
 * Append a request body stream to the upload file in bounded chunks
 * (PERF-02 — no full-body buffering for creation-with-upload). Stops as
 * soon as `maxBytes` is exceeded and reports `tooLarge` so the caller can
 * clean up; the caller must remove the row in that case.
 */
export async function appendStream(
	id: string,
	stream: ReadableStream<Uint8Array>,
	maxBytes: number,
): Promise<{ total: number; tooLarge: boolean }> {
	const reader = stream.getReader();
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				total += value.byteLength;
				if (total > maxBytes) return { total, tooLarge: true };
				await appendFile(uploadPath(id), value);
			}
		}
	} finally {
		reader.cancel().catch(() => {});
	}
	return { total, tooLarge: false };
}

/** Write a complete file in one shot (used for server-side downloaded avatars). */
export async function writeBytes(id: string, data: Uint8Array): Promise<void> {
	await writeFile(uploadPath(id), data);
}

/** Detect common file signatures from a bounded prefix, never client metadata. */
export function detectMimeFromBytes(bytes: Uint8Array): string | null {
	const startsWith = (values: number[]): boolean =>
		values.every((value, index) => bytes[index] === value);
	if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		return "image/png";
	if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
	if (startsWith([0x47, 0x49, 0x46, 0x38])) return "image/gif";
	if (
		startsWith([0x52, 0x49, 0x46, 0x46]) &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	)
		return "image/webp";
	if (startsWith([0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
	if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
	return null;
}

/** Detect a stored upload's signature using at most 512 bytes. */
export async function detectMime(id: string): Promise<string | null> {
	const prefix = new Uint8Array(
		await Bun.file(uploadPath(id)).slice(0, 512).arrayBuffer(),
	);
	return detectMimeFromBytes(prefix);
}

/** Current size of the stored file (used to reconcile offset on HEAD). */
export function fileSize(id: string): number {
	try {
		return statSyncSync(uploadPath(id)).size;
	} catch {
		return 0;
	}
}

/** Remove the on-disk file (best-effort, used on termination/sweep). */
export function removeFile(id: string): void {
	try {
		rmSyncSync(uploadPath(id), { force: true });
	} catch {
		/* ignore — file may already be gone */
	}
}
