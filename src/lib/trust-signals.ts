// src/lib/trust-signals.ts

// Static mapping: detection pattern key → tag slug
const SIGNAL_TO_SLUG: Record<string, string> = {
  content_credentials: "content-credentials",
  trust_project: "trust-project",
  jti_certified: "jti-certified",
  ifcn_signatory: "ifcn-signatory",
  creative_commons: "creative-commons",
  not_by_ai: "not-by-ai",
  indieweb: "indieweb",
  // editorial_standards_url: NOT mapped — it's a URL, kept in jsonb
};

// Platform string → tag slug
const PLATFORM_TO_SLUG: Record<string, string> = {
  wordpress: "wordpress",
  ghost: "ghost",
  substack: "substack",
  bearblog: "bearblog",
  mastodon: "mastodon",
  lemmy: "lemmy",
  microblog: "microblog",
  neocities: "neocities",
  tumblr: "tumblr",
  medium: "medium",
  blogger: "blogger",
  custom: "custom",
};

export interface EnrichmentResult {
  suggested_tag_slugs: string[];
  editorial_standards_url?: string; // kept as raw data (not a tag)
  _enrichment_failed?: boolean;
}

/** Legacy: verified membership signal keys (for PATCH route compat — see Task 6) */
export const VERIFIED_SIGNALS: readonly string[] = [
  "content_credentials",
  "trust_project",
  "jti_certified",
  "ifcn_signatory",
];

/** Legacy: values alignment signal keys (for PATCH route compat — see Task 6) */
export const VALUES_SIGNALS: readonly string[] = [
  "creative_commons",
  "not_by_ai",
  "indieweb",
];

/** Legacy: all trust signal keys excluding metadata keys (for PATCH route compat — see Task 6) */
export const ALL_TRUST_KEYS: readonly string[] = [
  ...VERIFIED_SIGNALS,
  ...VALUES_SIGNALS,
  "editorial_standards_url",
];

type DetectionRule = {
  key: string;
  patterns: RegExp[];
  extractor?: (match: RegExpMatchArray, html: string) => string | boolean;
};

const DETECTION_RULES: DetectionRule[] = [
  {
    key: "content_credentials",
    patterns: [
      /contentcredentials\.org/i,
      /c2pa\.org/i,
      /contentauthenticity\.org/i,
      /class="[^"]*c2pa[^"]*"/i,
      /c2pa-content-credentials/i,
    ],
  },
  {
    key: "trust_project",
    patterns: [/thetrustproject\.org/i],
  },
  {
    key: "creative_commons",
    patterns: [
      /<a[^>]*rel="license"[^>]*href="([^"]*creativecommons\.org\/licenses\/([^"]+))"[^>]*>/i,
      /licensebuttons\.net/i,
    ],
    extractor: (match: RegExpMatchArray) => {
      if (match[2]) return match[2].replace(/\/$/, "");
      return "licensed"; // licensebuttons.net matched without capture group
    },
  },
  {
    key: "jti_certified",
    patterns: [/journalismtrustinitiative\.org/i, /JTI\s*(certified|compliant)/i],
  },
  {
    key: "ifcn_signatory",
    patterns: [/ifcncodeofprinciples\.poynter\.org/i, /IFCN\s*(signatory|verified)/i],
  },
  {
    key: "not_by_ai",
    patterns: [/notbyai\.fyi/i, /not\s+by\s+ai/i],
  },
  {
    key: "indieweb",
    patterns: [
      /<link[^>]*rel="webmention"[^>]*\/?>/i,
      /indieweb\.org/i,
      /rel="micropub"/i,
    ],
  },
  {
    key: "editorial_standards_url",
    patterns: [
      /<a[^>]*href="([^"]*(?:ethics|standards|editorial-policy|code-of-conduct|about\/principles)[^"]*)"[^>]*>/i,
    ],
    extractor: (match: RegExpMatchArray) => {
      let url = match[1];
      if (url && !url.startsWith("http")) {
        return url; // caller resolves against site_url
      }
      return url || false;
    },
  },
];

const PRIVATE_IP_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/0\.0\.0\.0/,
];

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(url)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Fetch homepage HTML and detect trust signals.
 * Returns {_enrichment_failed: true} on failure (network error, timeout, etc.)
 * so the caller can distinguish "no signals found" from "couldn't check."
 */
export async function detectTrustSignals(
  siteUrl: string,
  platform?: string,
  hasTrackers?: boolean,
): Promise<EnrichmentResult> {
  if (!siteUrl) return { suggested_tag_slugs: [], _enrichment_failed: true };
  if (!isSafeUrl(siteUrl)) return { suggested_tag_slugs: [], _enrichment_failed: true };

  const suggested_tag_slugs: string[] = [];
  let editorial_standards_url: string | undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(siteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "InternetCurators/1.0 (trust-signal-detection; +https://internet-curators.vercel.app)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      clearTimeout(timer);
      return { suggested_tag_slugs: [], _enrichment_failed: true };
    }

    // Read body with size cap (abort timer covers this)
    const text = await response.text();
    clearTimeout(timer);

    if (text.length > MAX_BODY_BYTES) return { suggested_tag_slugs: [], _enrichment_failed: true };

    const html = text;

    for (const rule of DETECTION_RULES) {
      for (const pattern of rule.patterns) {
        const match = html.match(pattern);
        if (match) {
          if (rule.key === "editorial_standards_url") {
            // This stays as raw data (a URL), not a tag
            if (rule.extractor) {
              const extracted = rule.extractor(match, html);
              if (extracted && typeof extracted === "string") {
                editorial_standards_url = extracted;
              }
            }
          } else {
            // Map detection match to tag slug
            const slug = SIGNAL_TO_SLUG[rule.key];
            if (slug) suggested_tag_slugs.push(slug);
          }
          break;
        }
      }
    }

    // Map platform to tag slug
    if (platform) {
      const platformSlug = PLATFORM_TO_SLUG[platform.toLowerCase()];
      if (platformSlug) suggested_tag_slugs.push(platformSlug);
    }

    // Map no-trackers to tag slug
    if (hasTrackers === false) {
      suggested_tag_slugs.push("no-trackers");
    }

    return { suggested_tag_slugs, editorial_standards_url, _enrichment_failed: false };
  } catch {
    return { suggested_tag_slugs: [], _enrichment_failed: true };
  }
}
            }
          } else {
            const slug = SIGNAL_TO_SLUG[rule.key];
            if (slug) suggested_tag_slugs.push(slug);
          }
          break;
        }
      }
    }

    // Map platform to tag slug
    if (platform && PLATFORM_TO_SLUG[platform.toLowerCase()]) {
      suggested_tag_slugs.push(PLATFORM_TO_SLUG[platform.toLowerCase()]);
    }

    // Map no-trackers to tag slug
    if (hasTrackers === false) {
      suggested_tag_slugs.push("no-trackers");
    }

    return {
      suggested_tag_slugs,
      ...(editorial_standards_url ? { editorial_standards_url } : {}),
      _enrichment_failed: false,
    };
  } catch {
    return { suggested_tag_slugs: [], _enrichment_failed: true };
  }
}

/**
 * Merge trust signals into existing independence_signals jsonb.
 * Preserves existing keys, overwrites trust signal keys.
 * Marks _enrichment_attempted to prevent re-enrichment (even on failure).
 *
 * @deprecated Use detectTrustSignals → EnrichmentResult.suggested_tag_slugs instead.
 *   This function remains for backward compat with Task 3 transition.
 */
export function mergeTrustSignals(
  existingSignals: Record<string, unknown> | null,
  trustSignals: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(existingSignals ?? {}),
    ...trustSignals,
    _enrichment_attempted: true,
  };
}
