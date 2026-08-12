/**
 * Role management routes at /roles — list, create, update, delete and
 * permission assignment. Admin-only (requireRole + permission guards).
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { requirePermission, requireRole, setFlash } from "../auth";
import {
	assignRolePermission,
	clearRolePermissions,
	deleteRole,
	findPermissionBySlug,
	findRoleById,
	findRoleBySlug,
	insertRole,
	listPermissions,
	listRolePermissionSlugs,
	listRoles,
	updateRole,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import type { Permission, RoleRecord } from "../../shared/types";
import { validateJson } from "../validation";
import { recordActivity } from "../activity";

const slugPattern = "^[a-z0-9]+(\\.[a-z0-9]+)*$";

const roleBody = t.Object(
	{
		slug: t.String({ pattern: slugPattern, minLength: 2, maxLength: 64 }),
		name: t.String({ minLength: 2, maxLength: 80 }),
		description: t.Optional(t.String({ maxLength: 255 })),
	},
	{ additionalProperties: false },
);
const assignBody = t.Object(
	{ permissionSlugs: t.Array(t.String({ minLength: 1 })) },
	{ additionalProperties: false },
);

type RoleBody = Static<typeof roleBody>;
type AssignBody = Static<typeof assignBody>;

export const ROLES_VALIDATION_MESSAGES: Record<string, string> = {
	"/slug": "Slug must be lowercase letters, numbers and dots (e.g. users.read).",
	"/name": "Name must be at least 2 characters.",
	"/description": "Description is too long.",
	"/permissionSlugs": "Pick at least one permission.",
};

const BUILTIN_ROLES = new Set(["user", "admin", "super_admin"]);

function roleRecords(): RoleRecord[] {
	return listRoles.all().map((r) => ({
		...r,
		permissionSlugs: listRolePermissionSlugs.all(r.id).map((p) => p.slug),
	}));
}

function flash(c: import("hono").Context<AppEnv>, message: string): void {
	if (c.var.sessionToken) setFlash(c.var.sessionToken, { success: message });
}

export const rolesRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/roles", requireRole("admin"), requirePermission("roles.read"), (c) => {
		const permissions: Permission[] = listPermissions.all().map((p) => ({
			...p,
		}));
		return c.var.inertia.render("Roles", {
			roles: roleRecords(),
			permissions,
		});
	});

	app.post("/roles", requireRole("admin"), requirePermission("roles.create"), validateJson(roleBody), (c) => {
		const body = c.req.valid("json") as RoleBody;
		if (findRoleBySlug.get(body.slug)) {
			return c.var.inertia.error("Roles", {
				slug: "That slug is already used.",
			});
		}
		insertRole.run(body.slug, body.name, body.description || null);
		const acting = c.var.user;
		if (acting)
			recordActivity(c, acting.id, "roles.create", `Created role ${body.slug}`);
		flash(c, "Role created.");
		return c.var.inertia.redirect("/roles");
	});

	app.patch("/roles/:id", requireRole("admin"), requirePermission("roles.update"), validateJson(roleBody), (c) => {
		const id = Number(c.req.param("id"));
		const role = findRoleById.get(id);
		if (!role) return c.var.inertia.redirect("/roles");
		const body = c.req.valid("json") as RoleBody;
		if (BUILTIN_ROLES.has(role.slug) && body.slug !== role.slug) {
			return c.var.inertia.error("Roles", {
				slug: "Built-in role slugs cannot be renamed.",
			});
		}
		const slugRow = findRoleBySlug.get(body.slug);
		if (slugRow && slugRow.id !== id) {
			return c.var.inertia.error("Roles", {
				slug: "That slug is already used.",
			});
		}
		updateRole.run(body.slug, body.name, body.description || null, id);
		const acting = c.var.user;
		if (acting)
			recordActivity(c, acting.id, "roles.update", `Updated role ${body.slug}`);
		flash(c, "Role updated.");
		return c.var.inertia.redirect("/roles");
	});

	app.post("/roles/:id/permissions", requireRole("admin"), requirePermission("roles.assign"), validateJson(assignBody), (c) => {
		const id = Number(c.req.param("id"));
		if (!findRoleById.get(id)) return c.var.inertia.redirect("/roles");
		const body = c.req.valid("json") as AssignBody;
		clearRolePermissions.run(id);
		for (const slug of body.permissionSlugs) {
			const perm = findPermissionBySlug.get(slug);
			if (perm) assignRolePermission.run(id, perm.id);
		}
		const acting = c.var.user;
		if (acting)
			recordActivity(
				c,
				acting.id,
				"roles.assign",
				`Assigned ${body.permissionSlugs.length} permission(s) to role #${id}`,
			);
		flash(c, "Role permissions updated.");
		return c.var.inertia.redirect("/roles");
	});

	app.delete("/roles/:id", requireRole("admin"), requirePermission("roles.delete"), (c) => {
		const id = Number(c.req.param("id"));
		const role = findRoleById.get(id);
		if (!role) return c.var.inertia.redirect("/roles");
		if (BUILTIN_ROLES.has(role.slug)) {
			return c.var.inertia.error("Roles", {
				slug: "Built-in roles cannot be deleted.",
			});
		}
		deleteRole.run(id);
		const acting = c.var.user;
		if (acting)
			recordActivity(c, acting.id, "roles.delete", `Deleted role ${role.slug}`);
		flash(c, "Role deleted.");
		return c.var.inertia.redirect("/roles");
	});

	return app;
};
