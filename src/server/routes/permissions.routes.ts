/**
 * Permission management routes at /permissions — list, create, update,
 * delete. Admin-only (requireRole + permission guards).
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { requirePermission, requireRole, setFlash } from "../auth";
import {
	deletePermission,
	findPermissionById,
	findPermissionBySlug,
	insertPermission,
	listPermissions,
	updatePermission,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import type { Permission } from "../../shared/types";
import { validateJson } from "../validation";

const slugPattern = "^[a-z0-9]+(\\.[a-z0-9]+)*$";

const permissionBody = t.Object(
	{
		slug: t.String({ pattern: slugPattern, minLength: 2, maxLength: 64 }),
		name: t.String({ minLength: 2, maxLength: 80 }),
		description: t.Optional(t.String({ maxLength: 255 })),
	},
	{ additionalProperties: false },
);

type PermissionBody = Static<typeof permissionBody>;

export const PERMISSIONS_VALIDATION_MESSAGES: Record<string, string> = {
	"/slug": "Slug must be lowercase letters, numbers and dots (e.g. users.read).",
	"/name": "Name must be at least 2 characters.",
	"/description": "Description is too long.",
};

const BUILTIN_SLUGS = new Set([
	"users.read",
	"users.create",
	"users.update",
	"users.delete",
	"users.activate",
	"roles.read",
	"roles.create",
	"roles.update",
	"roles.delete",
	"roles.assign",
	"permissions.read",
	"permissions.create",
	"permissions.update",
	"permissions.delete",
]);

function flash(c: import("hono").Context<AppEnv>, message: string): void {
	if (c.var.sessionToken) setFlash(c.var.sessionToken, { success: message });
}

export const permissionsRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/permissions", requireRole("admin"), requirePermission("permissions.read"), (c) => {
		const permissions: Permission[] = listPermissions.all().map((p) => ({
			...p,
		}));
		return c.var.inertia.render("Permissions", { permissions });
	});

	app.post("/permissions", requireRole("admin"), requirePermission("permissions.create"), validateJson(permissionBody), (c) => {
		const body = c.req.valid("json") as PermissionBody;
		if (findPermissionBySlug.get(body.slug)) {
			return c.var.inertia.error("Permissions", {
				slug: "That slug is already used.",
			});
		}
		insertPermission.run(body.slug, body.name, body.description || null);
		flash(c, "Permission created.");
		return c.var.inertia.redirect("/permissions");
	});

	app.patch("/permissions/:id", requireRole("admin"), requirePermission("permissions.update"), validateJson(permissionBody), (c) => {
		const id = Number(c.req.param("id"));
		const permission = findPermissionById.get(id);
		if (!permission) return c.var.inertia.redirect("/permissions");
		const body = c.req.valid("json") as PermissionBody;
		if (BUILTIN_SLUGS.has(permission.slug) && body.slug !== permission.slug) {
			return c.var.inertia.error("Permissions", {
				slug: "Built-in permission slugs cannot be renamed.",
			});
		}
		const slugRow = findPermissionBySlug.get(body.slug);
		if (slugRow && slugRow.id !== id) {
			return c.var.inertia.error("Permissions", {
				slug: "That slug is already used.",
			});
		}
		updatePermission.run(body.slug, body.name, body.description || null, id);
		flash(c, "Permission updated.");
		return c.var.inertia.redirect("/permissions");
	});

	app.delete("/permissions/:id", requireRole("admin"), requirePermission("permissions.delete"), (c) => {
		const id = Number(c.req.param("id"));
		const permission = findPermissionById.get(id);
		if (!permission) return c.var.inertia.redirect("/permissions");
		if (BUILTIN_SLUGS.has(permission.slug)) {
			return c.var.inertia.error("Permissions", {
				slug: "Built-in permissions cannot be deleted.",
			});
		}
		deletePermission.run(id);
		flash(c, "Permission deleted.");
		return c.var.inertia.redirect("/permissions");
	});

	return app;
};
