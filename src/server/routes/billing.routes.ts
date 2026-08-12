/**
 * Billing routes: placeholder module for the payment gateway. Renders the
 * current plan and a static payment history — real billing is a deliberate
 * swap point (see PRD Modul 17).
 */
import { Hono } from "hono";
import { requireAuth } from "../auth";
import type { AppEnv } from "../inertia-middleware";
import type { PaymentRow, PlanInfo } from "../../shared/types";

const PLAN: PlanInfo = {
	name: "Starter",
	price: "$0 / month",
	renewsAt: "—",
	limits: [
		{ label: "Team members", used: 3, max: 5 },
		{ label: "Storage", used: 2, max: 5 },
		{ label: "Projects", used: 1, max: 3 },
	],
};

const PAYMENTS: PaymentRow[] = [
	{
		id: "1",
		date: "2026-08-01",
		description: "Starter plan — monthly",
		amount: "$0.00",
		status: "paid",
		invoice: "INV-2026-0001",
	},
	{
		id: "2",
		date: "2026-07-01",
		description: "Starter plan — monthly",
		amount: "$0.00",
		status: "paid",
		invoice: "INV-2026-0002",
	},
];

export const billingRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/billing", requireAuth, (c) =>
		c.var.inertia.render("Billing", {
			plan: PLAN,
			payments: PAYMENTS,
		}),
	);

	return app;
};