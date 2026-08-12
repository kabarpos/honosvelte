/**
 * Media library routes: upload, list/search, serve, edit metadata, delete,
 * and a lightweight picker API. Files are stored under MEDIA_DIR and served
 * from /media/<id>; metadata lives in the `media` table.
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { Hono } from "hono";
import { requireAuth, requirePermission } from "../auth";
import { config } from "../config";
import {
	countMedia,
	deleteMediaById,
	findMediaById,
	insertMedia,
	listMedia,
	listMediaPicker,
	updateMediaMeta,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import { validateJson } from "../validation";
import { recordActivity } from "../activity";
import type { Media, MediaCategory, User } from "../../shared/types";
import type { Paginated } from "../../shared/types";

const CATEGORIES: MediaCategory[] = [
	"image",
	"video",
	"audio",
	"document",
	"archive",
	"other",
];

/** Content types that can carry scripts or markup — never stored/served. */
const BLOCKED_MIME_PREFIXES = ["image/svg", "text/html", "text/xml", "application/xhtml"];
const BLOCKED_MIME_EXACT = ["application/xml"];

function isBlockedMime(mime: string): boolean {
	return (
		BLOCKED_MIME_PREFIXES.some((p) => mime.startsWith(p)) ||
		BLOCKED_MIME_EXACT.includes(mime)
	);
}

function categoryForMime(mime: string): MediaCategory {
	const type = mime.split("/")[0] ?? "other";
	if (type === "image") return "image";
	if (type === "video") return "video";
	if (type === "audio") return "audio";
	if (["application/pdf", "text/"].some((p) => mime.startsWith(p)))
		return "document";
	if (
		["application/zip", "application/gzip", "application/x-tar", "application/x-7z-compressed"].includes(
			mime,
		)
	)
		return "archive";
	return "other";
}

/** Metadata edit body for PATCH /media/:id. */
const mediaMetaBody = t.Object(
	{
		originalName: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
		title: t.Optional(t.String({ maxLength: 120 })),
		altText: t.Optional(t.String({ maxLength: 200 })),
		description: t.Optional(t.String({ maxLength: 500 })),
	},
	{ additionalProperties: false },
);

type MediaMetaBody = Static<typeof mediaMetaBody>;

export const MEDIA_VALIDATION_MESSAGES: Record<string, string> = {
	"/originalName": "File name must be 1–255 characters.",
	"/title": "Title must be at most 120 characters.",
	"/altText": "Alt text must be at most 200 characters.",
	"/description": "Description must be at most 500 characters.",
};

function toMedia(row: NonNullable<ReturnType<typeof findMediaById.get>>): Media {
	return {
		id: row.id,
		userId: row.userId,
		originalName: row.originalName,
		mimeType: row.mimeType,
		size: row.size,
		category: (row.category as MediaCategory) ?? "other",
		title: row.title,
		altText: row.altText,
		description: row.description,
		createdAt: row.createdAt,
		url: `/media/${row.id}`,
	};
}

/** Admin manages every file; a regular user manages only their own. */
function canManage(user: User | null, media: { userId: number | null }): boolean {
	return (
		user !== null &&
		(user.role === "super_admin" || user.role === "admin" || media.userId === user.id)
	);
}

function scopeFilter(user: User | null): string {
	if (!user) return "-1";
	return user.role === "super_admin" || user.role === "admin" ? "" : String(user.id);
}

function paramId(value: string | undefined): number | null {
	if (!value) return null;
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
}

function filePath(filename: string): string {
	return join(config.media.dir, filename);
}

export const mediaRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/media", requireAuth, requirePermission("media.read"), (c) => {
		const user = c.var.user;
		const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
		const perPage = Math.min(
			100,
			Math.max(1, Number(c.req.query("perPage") ?? 20) || 20),
		);
		const categoryParam = String(c.req.query("category") ?? "");
		const search = String(c.req.query("search") ?? "");
		const category = (CATEGORIES.includes(categoryParam as MediaCategory)
			? categoryParam
			: "") as MediaCategory;
		const scope = scopeFilter(user);
		const like = `%${search}%`;
		const total = countMedia.get(category, category, scope, scope, like, like)?.n ?? 0;
		const media: Paginated<Media> = {
			data: listMedia
				.all(category, category, scope, scope, like, like, perPage, (page - 1) * perPage)
				.map(toMedia),
			meta: {
				currentPage: page,
				perPage,
				lastPage: Math.max(1, Math.ceil(total / perPage)),
				total,
			},
		};
		return c.var.inertia.render("Media", {
			media,
			categories: CATEGORIES,
			search,
			category,
		});
	});

	app.post("/media", requireAuth, requirePermission("media.create"), async (c) => {
		const user = c.var.user;
		if (!user) return c.json({ error: "Unauthorized." }, 401);
		const originalName = String(c.req.header("x-file-name") ?? "");
		if (!originalName) return c.json({ error: "x-file-name header is required." }, 400);
		const rawMime = String(c.req.header("content-type") ?? "").split(";")[0]!.trim();
		if (!rawMime) return c.json({ error: "Content-Type header is required." }, 400);
		const bytes = await c.req.raw.arrayBuffer();
		if (!bytes.byteLength) return c.json({ error: "Empty file." }, 400);
		if (config.upload.maxSize > 0 && bytes.byteLength > config.upload.maxSize)
			return c.json({ error: "File exceeds the configured size limit." }, 400);
		if (isBlockedMime(rawMime))
			return c.json({ error: "This file type is not allowed." }, 400);

		const category = categoryForMime(rawMime);
		const filename = `${randomUUID()}${extname(originalName).toLowerCase()}`;
		const writePath = filePath(filename);
		mkdirSync(dirname(writePath), { recursive: true });
		const result = insertMedia.get(
			user.id,
			filename,
			originalName,
			rawMime,
			bytes.byteLength,
			category,
		);
		if (!result)
			return c.json({ error: "Could not store the file." }, 500);
		writeFileSync(writePath, Buffer.from(bytes));

		recordActivity(
			c,
			user.id,
			"media.upload",
			`Uploaded ${originalName} (${bytes.byteLength} bytes)`,
		);

		if (c.req.header("x-inertia")) return c.var.inertia.redirect("/media");
		const row = findMediaById.get(result.id);
		return row
			? c.json({ media: toMedia(row) }, 201)
			: c.json({ error: "Could not store the file." }, 500);
	});

app.get("/media/picker", requireAuth, requirePermission("media.read"), (c) => {
		const q = String(c.req.query("q") ?? "");
		const like = `%${q}%`;
		const rows = listMediaPicker.all(like, like, like);
		return c.json({
			media: rows.map((r) => ({ ...r, url: `/media/${r.id}` })),
		});
	});

	app.get("/media/:id", requireAuth, requirePermission("media.read"), (c) => {
		const user = c.var.user;
		const id = paramId(c.req.param("id"));
		const row = id ? findMediaById.get(id) : null;
		if (!row) return c.json({ error: "Media not found." }, 404);
		if (!canManage(user, row)) return c.json({ error: "Not allowed." }, 403);

		const path = filePath(row.filename);
		if (!existsSync(path)) return c.json({ error: "Media file is missing on disk." }, 404);
		const inline = ["image", "video", "audio", "text/", "application/pdf"].some((p) =>
			row.mimeType.startsWith(p),
		);
		const file = Bun.file(path);
		return new Response(file, {
			headers: {
				"Content-Type": row.mimeType,
				"Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(row.originalName)}"`,
				"Cache-Control": "private, max-age=31536000, immutable",
			},
		});
	});

	app.patch("/media/:id", requireAuth, requirePermission("media.update"), validateJson(mediaMetaBody), (c) => {
		const user = c.var.user;
		const id = paramId(c.req.param("id"));
		const row = id ? findMediaById.get(id) : null;
		if (!row) return c.json({ error: "Media not found." }, 404);
		if (!canManage(user, row)) return c.json({ error: "Not allowed." }, 403);

		const body = c.req.valid("json") as MediaMetaBody;
		updateMediaMeta.get(
			body.originalName?.trim() || row.originalName,
			body.title ?? null,
			body.altText ?? null,
			body.description ?? null,
			row.id,
		);
		if (user)
			recordActivity(c, user.id, "media.update", `Updated metadata of media #${row.id}`);
		return c.var.inertia.redirect("/media");
	});

	app.delete("/media/:id", requireAuth, requirePermission("media.delete"), (c) => {
		const user = c.var.user;
		const id = paramId(c.req.param("id"));
		const row = id ? findMediaById.get(id) : null;
		if (!row) return c.json({ error: "Media not found." }, 404);
		if (!canManage(user, row)) return c.json({ error: "Not allowed." }, 403);

		const path = filePath(row.filename);
		if (existsSync(path)) unlinkSync(path);
		deleteMediaById.get(row.id);
		if (user)
			recordActivity(c, user.id, "media.delete", `Deleted media #${row.id} (${row.originalName})`);
		return c.var.inertia.redirect("/media");
	});

	return app;
};