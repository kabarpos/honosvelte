/**
 * User management routes at /users — list, create, update, delete and
 * activate/deactivate. Admin-only (requireRole + permission guards).
 */
import { Type as t, type Static } from "@sinclair/typebox";
import { Hono } from "hono";
import { hashPassword, requirePermission, requireRole, setFlash } from "../auth";
import {
	countSearchUsers,
	countUsers,
	createUserFull,
	deleteUser,
	findUserByEmail,
	findUserById,
	listRolePermissionSlugs,
	listRoles,
	listUsers,
	searchUsers,
	setUserStatus,
	toPublicUser,
	updateUserAdmin,
	updateUserPassword,
} from "../db";
import type { AppEnv } from "../inertia-middleware";
import type { Paginated, Role, RoleRecord, User, UserStatus } from "../../shared/types";
import { validateJson } from "../validation";

const roleEnum = ["user", "admin", "super_admin"] as const;
const statusEnum = ["active", "inactive"] as const;

const createBody = t.Object(
	{
		name: t.String({ minLength: 2, maxLength: 80 }),
		email: t.String({ format: "email" }),
		whatsapp: t.Optional(t.String({ maxLength: 32 })),
		role: t.Union(roleEnum.map((r) => t.Literal(r))),
		status: t.Union(statusEnum.map((s) => t.Literal(s))),
		password: t.String({ minLength: 8, maxLength: 72 }),
		passwordConfirmation: t.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);
const updateBody = t.Object(
	{
		name: t.String({ minLength: 2, maxLength: 80 }),
		email: t.String({ format: "email" }),
		whatsapp: t.Optional(t.String({ maxLength: 32 })),
		role: t.Union(roleEnum.map((r) => t.Literal(r))),
		status: t.Union(statusEnum.map((s) => t.Literal(s))),
		password: t.Optional(t.String({ minLength: 8, maxLength: 72 })),
		passwordConfirmation: t.Optional(t.String({ minLength: 1 })),
	},
	{ additionalProperties: false },
);
const statusBody = t.Object(
	{ status: t.Union(statusEnum.map((s) => t.Literal(s))) },
	{ additionalProperties: false },
);

type CreateBody = Static<typeof createBody>;
type UpdateBody = Static<typeof updateBody>;
type StatusBody = Static<typeof statusBody>;

export const USERS_VALIDATION_MESSAGES: Record<string, string> = {
	"/name": "Name must be at least 2 characters.",
	"/email": "Enter a valid email address.",
	"/role": "Pick a valid role.",
	"/status": "Pick a valid status.",
	"/password": "Password must be at least 8 characters.",
	"/passwordConfirmation": "Confirm the password.",
	"/whatsapp": "WhatsApp number is too long.",
};

function roleRecords(): RoleRecord[] {
	return listRoles.all().map((r) => ({
		...r,
		permissionSlugs: listRolePermissionSlugs.all(r.id).map((p) => p.slug),
	}));
}

function usersPage(
	page: number,
	perPage: number,
	search: string,
): Paginated<User> {
	const like = `%${search}%`;
	const total = search
		? (countSearchUsers.get(like)?.n ?? 0)
		: (countUsers.get()?.n ?? 0);
	const rows = search
		? searchUsers.all(like, perPage, (page - 1) * perPage)
		: listUsers.all(perPage, (page - 1) * perPage);
	return {
		data: rows.map(toPublicUser),
		meta: {
			currentPage: page,
			perPage,
			lastPage: Math.max(1, Math.ceil(total / perPage)),
			total,
		},
	};
}

function flash(c: import("hono").Context<AppEnv>, message: string): void {
	if (c.var.sessionToken) setFlash(c.var.sessionToken, { success: message });
}

export const usersRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/users", requireRole("admin"), requirePermission("users.read"), (c) => {
		const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
		const perPage = Math.min(
			100,
			Math.max(1, Number(c.req.query("perPage") ?? 10) || 10),
		);
		const search = (c.req.query("search") ?? "").trim();
		return c.var.inertia.render("Users", {
			users: usersPage(page, perPage, search),
			roles: roleRecords(),
			search,
		});
	});

	app.post("/users", requireRole("admin"), requirePermission("users.create"), validateJson(createBody), async (c) => {
		const body = c.req.valid("json") as CreateBody;
		if (body.password !== body.passwordConfirmation) {
			return c.var.inertia.error("Users", {
				password: "Password confirmation does not match.",
			});
		}
		if (findUserByEmail.get(body.email)) {
			return c.var.inertia.error("Users", {
				email: "That email is already registered.",
			});
		}
		const passwordHash = await hashPassword(body.password);
		createUserFull.run(
			body.name,
			body.email,
			passwordHash,
			body.whatsapp || null,
			body.role as Role,
			body.status as UserStatus,
		);
		flash(c, "User created.");
		return c.var.inertia.redirect("/users");
	});

	app.patch("/users/:id", requireRole("admin"), requirePermission("users.update"), validateJson(updateBody), async (c) => {
		const id = Number(c.req.param("id"));
		if (!findUserById.get(id)) return c.var.inertia.redirect("/users");
		const body = c.req.valid("json") as UpdateBody;
		if (
			body.password &&
			body.passwordConfirmation &&
			body.password !== body.passwordConfirmation
		) {
			return c.var.inertia.error("Users", {
				password: "Password confirmation does not match.",
			});
		}
		const emailRow = findUserByEmail.get(body.email);
		if (emailRow && emailRow.id !== id) {
			return c.var.inertia.error("Users", {
				email: "That email is already registered.",
			});
		}
		updateUserAdmin.run(
			body.name,
			body.email,
			body.whatsapp || null,
			body.role as Role,
			body.status as UserStatus,
			id,
		);
		if (body.password) {
			const passwordHash = await hashPassword(body.password);
			updateUserPassword.run(passwordHash, id);
		}
		flash(c, "User updated.");
		return c.var.inertia.redirect("/users");
	});

	app.post("/users/:id/status", requireRole("admin"), requirePermission("users.activate"), validateJson(statusBody), (c) => {
		const id = Number(c.req.param("id"));
		if (!findUserById.get(id)) return c.var.inertia.redirect("/users");
		const body = c.req.valid("json") as StatusBody;
		setUserStatus.run(body.status as UserStatus, id);
		flash(
			c,
			body.status === "active" ? "User activated." : "User deactivated.",
		);
		return c.var.inertia.redirect("/users");
	});

	app.delete("/users/:id", requireRole("admin"), requirePermission("users.delete"), (c) => {
		const id = Number(c.req.param("id"));
		const current = c.var.user;
		if (!current || id === current.id) {
			return c.var.inertia.error("Users", {
				email: "You cannot delete your own account.",
			});
		}
		const target = findUserById.get(id);
		if (!target) return c.var.inertia.redirect("/users");
		if (target.role === "super_admin") {
			return c.var.inertia.error("Users", {
				email: "Super admin accounts cannot be deleted.",
			});
		}
		deleteUser.run(id);
		flash(c, "User deleted.");
		return c.var.inertia.redirect("/users");
	});

	return app;
};
