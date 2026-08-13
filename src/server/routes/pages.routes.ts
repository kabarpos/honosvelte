/**
 * Page routes: the Inertia app-shell pages (/, /dashboard).
 * Feature pages get their own `<feature>.routes.ts` — see AGENTS.md
 * "Route conventions".
 */
import { Hono } from "hono";
import { requireAuth } from "../auth";
import type { AppEnv } from "../inertia-middleware";

export const pageRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/", (c) =>
		c.var.user
			? c.var.inertia.redirect("/dashboard", 302)
			: c.var.inertia.render("Landing", {}),
	);
	app.get("/about", (c) => c.var.inertia.render("About"));
	app.get("/services", (c) => c.var.inertia.render("Services"));
	app.get("/contact", (c) =>
		c.var.inertia.render("Contact", { sent: c.req.query("sent") === "1" }),
	);
	app.get("/dashboard", requireAuth, (c) =>
		c.var.inertia.render("Dashboard", {}),
	);
	return app;
};
