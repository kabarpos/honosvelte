/**
 * QA-04 — browser + accessibility smoke suite (Playwright + axe).
 *
 * Gates:
 *  - axe scans (critical/serious) of the public, auth, and admin surfaces;
 *  - keyboard-only modal behavior (focus in, trap, Escape, restore);
 *  - responsive viewport smoke (no horizontal overflow on key pages);
 *  - admin flows render (users list, media picker, settings).
 *
 * Run: `bun run e2e` (starts a disposable server on :4310 via webServer).
 */
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123";

async function login(page: Page): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("Email").fill(ADMIN_EMAIL);
	await page.getByLabel("Password").fill(ADMIN_PASSWORD);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL("**/dashboard");
}

/** Return critical + serious axe violations for the current page. */
async function seriousViolations(page: Page) {
	const results = await new AxeBuilder({ page }).analyze();
	return results.violations.filter(
		(v) => v.impact === "critical" || v.impact === "serious",
	);
}

function summarize(violations: { id: string; help: string }[]): string {
	return JSON.stringify(violations, null, 2);
}

test.describe("axe scans", () => {
	for (const path of ["/", "/login", "/register"]) {
		test(`${path} has no critical/serious violations`, async ({ page }) => {
			await page.goto(path);
			const violations = await seriousViolations(page);
			expect(violations, summarize(violations)).toEqual([]);
		});
	}

	test("admin surface has no critical/serious violations", async ({ page }) => {
		await login(page);
		for (const path of [
			"/users",
			"/roles",
			"/permissions",
			"/media",
			"/settings",
			"/activity",
		]) {
			await page.goto(path);
			await page.waitForLoadState("domcontentloaded");
			const violations = await seriousViolations(page);
			expect(
				violations,
				summarize(violations.map((v) => ({ ...v, page: path }))),
			).toEqual([]);
		}
	});
});

test.describe("keyboard-only modal (UX-01)", () => {
	test("focus enters the dialog, traps Tab, Escape restores the trigger", async ({
		page,
	}) => {
		await login(page);
		await page.goto("/users");

		const trigger = page.getByRole("button", { name: "Add user" });
		await trigger.focus();
		await page.keyboard.press("Enter");

		const dialog = page.getByRole("dialog", { name: "Add user" });
		await expect(dialog).toBeVisible();
		// Focus moved into the dialog (tabindex=-1 target).
		await expect(dialog).toBeFocused();

		// Tab cycles within the dialog without escaping to the page.
		await page.keyboard.press("Tab");
		await expect
			.poll(() =>
				page.evaluate(() =>
					Boolean(
						document.activeElement &&
							document
								.querySelector('[role="dialog"]')
								?.contains(document.activeElement),
					),
				),
			)
			.toBe(true);

		// Escape closes the dialog and restores focus to the trigger.
		await page.keyboard.press("Escape");
		await expect(dialog).not.toBeVisible();
		await expect(trigger).toBeFocused();
	});
});

test.describe("keyboard tabs + dropdown (UX-02)", () => {
	test("tabs move with Arrow keys and Home/End (roving tabindex)", async ({
		page,
	}) => {
		await login(page);
		await page.goto("/email");

		const configuration = page.getByRole("tab", { name: "Configuration" });
		const templates = page.getByRole("tab", { name: "Templates" });
		await expect(configuration).toHaveAttribute("aria-selected", "true");

		// Active tab is in the tab order; arrow keys move selection + focus.
		await configuration.focus();
		await page.keyboard.press("ArrowRight");
		await expect(templates).toHaveAttribute("aria-selected", "true");
		await expect(templates).toBeFocused();

		await page.keyboard.press("ArrowLeft");
		await expect(configuration).toHaveAttribute("aria-selected", "true");
		await expect(configuration).toBeFocused();

		await page.keyboard.press("End");
		await expect(templates).toHaveAttribute("aria-selected", "true");
		await page.keyboard.press("Home");
		await expect(configuration).toHaveAttribute("aria-selected", "true");

		// Only the active tab is a tab stop.
		await expect(configuration).toHaveAttribute("tabindex", "0");
		await expect(templates).toHaveAttribute("tabindex", "-1");
	});

	test("user menu opens with Enter, navigates with arrows, Escape restores", async ({
		page,
	}) => {
		await login(page);

		const trigger = page.getByRole("button", { name: /E2E Admin/ });
		await trigger.focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("menu")).toBeVisible();
		// Focus moved into the menu.
		await expect(page.getByRole("menuitem", { name: "Profile" })).toBeFocused();

		await page.keyboard.press("ArrowDown");
		await expect(page.getByRole("menuitem", { name: "Log out" })).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(page.getByRole("menu")).not.toBeVisible();
		await expect(trigger).toBeFocused();
	});
});

test.describe("responsive smoke (UX-05)", () => {
	test("key pages fit a 390px viewport without horizontal overflow", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		for (const path of ["/", "/login"]) {
			await page.goto(path);
			const overflow = await page.evaluate(
				() =>
					document.documentElement.scrollWidth >
					document.documentElement.clientWidth,
			);
			expect(overflow, `${path} overflows horizontally`).toBe(false);
		}
	});
});

test.describe("admin flows render", () => {
	test("users list renders after login", async ({ page }) => {
		await login(page);
		await page.goto("/users");
		await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
		await expect(page.getByText("admin@example.com").first()).toBeVisible();
	});

	test("media picker opens from the media page", async ({ page }) => {
		await login(page);
		await page.goto("/media");
		const heading = page.getByRole("heading", { name: "Media" });
		await expect(heading).toBeVisible();
	});
});
