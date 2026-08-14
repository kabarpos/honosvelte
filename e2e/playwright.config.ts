import { defineConfig, devices } from "@playwright/test";

const PORT = 4310;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: ".",
	timeout: 60_000,
	fullyParallel: false,
	workers: 1,
	reporter: [["list"]],
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
	},
	webServer: {
		command: "bun run e2e:server",
		url: `${BASE_URL}/health`,
		reuseExistingServer: false,
		timeout: 60_000,
		env: {
			PORT: String(PORT),
			NODE_ENV: "production",
			DATABASE_PATH: "./data/e2e.sqlite",
			UPLOAD_DIR: "./data/e2e-uploads",
			MEDIA_DIR: "./data/e2e-media",
			RATE_LIMIT_AUTH_MAX: "1000",
			APP_URL: BASE_URL,
		},
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
	],
});
