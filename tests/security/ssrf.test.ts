import { describe, expect, it } from "bun:test";
import {
	assertPublicHost,
	isPrivateAddress,
	isPrivateHostname,
} from "../../src/server/ssrf";

describe("SSRF guard", () => {
	it("flags private, loopback, link-local, CGNAT, and metadata addresses", () => {
		for (const address of [
			"127.0.0.1",
			"10.0.0.5",
			"172.16.0.1",
			"172.31.255.255",
			"192.168.1.1",
			"169.254.169.254",
			"100.64.0.1",
			"0.0.0.0",
			"::1",
			"fe80::1",
			"fc00::1",
		]) {
			expect(isPrivateAddress(address)).toBe(true);
		}
	});

	it("allows public addresses", () => {
		for (const address of ["8.8.8.8", "1.1.1.1", "2001:4860:4860::8888"]) {
			expect(isPrivateAddress(address)).toBe(false);
		}
	});

	it("flags private IP literals used as hostnames", () => {
		expect(isPrivateHostname("169.254.169.254")).toBe(true);
		expect(isPrivateHostname("10.1.2.3")).toBe(true);
		expect(isPrivateHostname("8.8.8.8")).toBe(false);
		expect(isPrivateHostname("example.com")).toBe(false);
	});

	it("rejects private IP literals through assertPublicHost", async () => {
		await expect(assertPublicHost("127.0.0.1")).rejects.toThrow();
		await expect(assertPublicHost("169.254.169.254")).rejects.toThrow();
		await expect(assertPublicHost("8.8.8.8")).resolves.toBeUndefined();
	});
});
