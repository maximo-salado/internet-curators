import { lookup } from "dns/promises";

const PRIVATE_IP_RE = [
  /^127\./,                                      // loopback
  /^10\./,                                        // RFC 1918
  /^172\.(1[6-9]|2[0-9]|3[01])\./,              // RFC 1918
  /^192\.168\./,                                  // RFC 1918
  /^169\.254\./,                                  // link-local
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // RFC 6598 shared address
  /^0\./,                                         // "this" network (RFC 1122)
  /^::1$/,                                        // IPv6 loopback
  /^f[cd][0-9a-f]{2}:/i,                         // IPv6 unique local (fc00::/7)
  /^fe80:/i,                                      // IPv6 link-local
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RE.some((re) => re.test(ip));
}

export async function validateFeedUrl(
  rawUrl: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Feed URL must use HTTPS" };
  }

  try {
    const { address } = await lookup(parsed.hostname);
    if (isPrivateIp(address)) {
      return {
        valid: false,
        error: "Feed URL must not resolve to a private or loopback address",
      };
    }
  } catch {
    return { valid: false, error: "Could not resolve feed hostname" };
  }

  return { valid: true };
}
