/**
 * SEC-09 regression tests: rate-limit client-key resolution.
 *
 * Trust contract:
 *  - `X-Forwarded-For` is ONLY honored when the direct peer belongs to the
 *    configured TRUSTED_PROXY networks; otherwise it is ignored entirely
 *    (spoofed headers must not let an attacker rotate the rate-limit key).
 *  - The auth limiter is account-aware: a targeted account is protected
 *    regardless of the IP used, while an IP spraying many accounts still
 *    trips the client bucket.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { ipInNetwork, resolveClientKey } from "../../src/server/rate-limit";

let app: Awaited<ReturnType<typeof import("../../src/server/app")["createApp"]>>;

beforeAll(async () => {
	process.env.DATABASE_PATH = ":memory:";
	process.env.NODE_ENV = "test";
	process.env.RATE_LIMIT_AUTH_MAX = "3";
	// No TRUSTED_PROXY configured — the default, spoof-unsafe-against setup.
	const { createApp } = await import("../../src/server/app");
	app = createApp({ version: "test-version", js: "app.js", css: "app.css" });
});

afterAll(async () => {
	const { db } = await import("../../src/server/db");
	db.close();
});

const BASE = "http://localhost:3000";

async function loginAttempt(xff: string, email: string): Promise<Response> {
	return app.request(`${BASE}/login`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-forwarded-for": xff,
		},
		body: JSON.stringify({ email, password: "wrong-pass" }),
	});
}

describe("resolveClientKey — X-Forwarded-For trust boundary", () => {
	it("ignores X-Forwarded-For from an untrusted direct peer", () => {
		expect(
			resolveClientKey({
				peerIp: "203.0.113.9",
				forwardedFor: "1.2.3.4",
				trustedProxies: [],
			}),
		).toBe("203.0.113.9");
		expect(
			resolveClientKey({
				peerIp: "203.0.113.9",
				forwardedFor: "1.2.3.4, 10.0.0.1",
				trustedProxies: ["10.0.0.0/8"],
			}),
		).toBe("203.0.113.9");
	});

	it("honors X-Forwarded-For when the peer is a trusted proxy", () => {
		expect(
			resolveClientKey({
				peerIp: "10.0.0.5",
				forwardedFor: "198.51.100.7, 10.0.0.1",
				trustedProxies: ["10.0.0.0/8"],
			}),
		).toBe("198.51.100.7");
	});

	it("uses only the FIRST (client-most) entry from a trusted proxy", () => {
		// Later entries are appended by each proxy hop and are not
		// attacker-controllable in the same way — the client-most one wins.
		expect(
			resolveClientKey({
				peerIp: "10.0.0.5",
				forwardedFor: "198.51.100.7, 192.0.2.1",
				trustedProxies: ["10.0.0.0/8"],
			}),
		).toBe("198.51.100.7");
	});

	it("rejects malformed X-Forwarded-For values even from trusted proxies", () => {
		expect(
			resolveClientKey({
				peerIp: "10.0.0.5",
				forwardedFor: "not-an-ip",
				trustedProxies: ["10.0.0.0/8"],
			}),
		).toBe("10.0.0.5");
		expect(
			resolveClientKey({
				peerIp: "10.0.0.5",
				forwardedFor: "999.1.1.1",
				trustedProxies: ["10.0.0.0/8"],
			}),
		).toBe("10.0.0.5");
	});

	it("normalizes IPv4-mapped IPv6 peers", () => {
		expect(
			resolveClientKey({
				peerIp: "::ffff:127.0.0.1",
				forwardedFor: "203.0.113.3",
				trustedProxies: ["127.0.0.1"],
			}),
		).toBe("203.0.113.3");
	});

	it("falls back to 'local' when no peer IP is known", () => {
		expect(
			resolveClientKey({ peerIp: null, forwardedFor: "1.2.3.4" }),
		).toBe("local");
	});
});

describe("ipInNetwork", () => {
	it("matches exact IPs", () => {
		expect(ipInNetwork("127.0.0.1", "127.0.0.1")).toBe(true);
		expect(ipInNetwork("127.0.0.2", "127.0.0.1")).toBe(false);
		expect(ipInNetwork("10.0.0.1", "10.0.0.2")).toBe(false);
	});

	it("matches IPv4 CIDR boundaries", () => {
		expect(ipInNetwork("10.0.0.1", "10.0.0.0/8")).toBe(true);
		expect(ipInNetwork("10.255.255.255", "10.0.0.0/8")).toBe(true);
		expect(ipInNetwork("11.0.0.1", "10.0.0.0/8")).toBe(false);
		expect(ipInNetwork("192.168.1.63", "192.168.1.0/26")).toBe(true);
		expect(ipInNetwork("192.168.1.64", "192.168.1.0/26")).toBe(false);
		expect(ipInNetwork("192.168.1.128", "192.168.1.128/32")).toBe(true);
	});

	it("rejects malformed inputs", () => {
		expect(ipInNetwork("", "10.0.0.0/8")).toBe(false);
		expect(ipInNetwork("10.0.0.1", "")).toBe(false);
		expect(ipInNetwork("10.0.0.1", "10.0.0.0/99")).toBe(false);
		expect(ipInNetwork("10.0.0.1", "banana")).toBe(false);
	});
});

describe("X-Forwarded-For spoofing cannot bypass the login limiter", () => {
	it("keeps a single bucket when the client rotates the header (no TRUSTED_PROXY)", async () => {
		// 3 attempts with DIFFERENT spoofed XFF values must consume one
		// shared bucket (peer key), so the 4th is blocked regardless of the
		// header the attacker sets.
		const codes: number[] = [];
		const xffs = ["1.2.3.4", "5.6.7.8", "9.10.11.12", "13.14.15.16"];
		for (let i = 0; i < xffs.length; i++) {
			codes.push((await loginAttempt(xffs[i]!, `user${i}@example.com`)).status);
		}
		expect(codes[0]).not.toBe(429);
		expect(codes[1]).not.toBe(429);
		expect(codes[2]).not.toBe(429);
		expect(codes[3]).toBe(429);
	});
});
