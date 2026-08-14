/**
 * Outbound SSRF guard: block private, loopback, link-local, CGNAT, and
 * metadata-address targets before the server fetches an external URL.
 * Uses `node:net` for IP literals and Bun's async resolver for hostnames
 * (defence against DNS-rebinding style resolution to private ranges).
 */
import { isIP } from "node:net";

function isPrivateV4(address: string): boolean {
	return (
		address.startsWith("0.") ||
		address.startsWith("127.") ||
		address.startsWith("10.") ||
		address.startsWith("192.168.") ||
		address.startsWith("169.254.") ||
		address.startsWith("100.64.") ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
		/^224\./.test(address) ||
		/^24[0-5]\./.test(address)
	);
}

function isPrivateV6(address: string): boolean {
	const lower = address.toLowerCase();
	if (lower === "::" || lower === "::1") return true;
	if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb"))
		return true; // link-local fe80::/10
	if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
	if (lower.startsWith("ff")) return true; // multicast
	if (lower.startsWith("::ffff:")) {
		// IPv4-mapped IPv6 — re-check the embedded IPv4 address.
		const embedded = lower.slice("::ffff:".length);
		if (embedded.includes(".") && isIP(embedded) === 4) {
			return isPrivateV4(embedded);
		}
	}
	return false;
}

/** True when `address` is a private/loopback/link-local/metadata target. */
export function isPrivateAddress(address: string): boolean {
	const version = isIP(address);
	if (version === 4) return isPrivateV4(address);
	if (version === 6) return isPrivateV6(address);
	return false;
}

/** True when a hostname literal is private (no DNS resolution involved). */
export function isPrivateHostname(hostname: string): boolean {
	if (isIP(hostname)) return isPrivateAddress(hostname);
	return false;
}

async function resolveAddresses(hostname: string): Promise<string[]> {
	try {
		const results = await Bun.dns.lookup(hostname, { family: 0 });
		return results.map((result) => result.address);
	} catch {
		return [];
	}
}

/** Throw when `hostname` resolves to any private/loopback/link-local target. */
export async function assertPublicHost(hostname: string): Promise<void> {
	if (isPrivateHostname(hostname))
		throw new Error(`Blocked outbound target: ${hostname}`);
	if (isIP(hostname)) return;
	const addresses = await resolveAddresses(hostname);
	for (const address of addresses) {
		if (isPrivateAddress(address))
			throw new Error(`Blocked private outbound target: ${address}`);
	}
}
