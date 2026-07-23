// src/lib/trust-signals.ts

export interface TrustSignals {
  // Verified membership (emerald green)
  content_credentials?: boolean;
  trust_project?: boolean;
  jti_certified?: boolean;
  ifcn_signatory?: boolean;

  // Values alignment (amber)
  creative_commons?: string; // license type string, e.g. "CC BY 4.0"
  not_by_ai?: boolean;
  indieweb?: boolean;

  // Research aid (link, not badge)
  editorial_standards_url?: string;

  // Enrichment metadata (internal, not displayed as badges)
  _enrichment_failed?: boolean;
}

/** Verified membership signal keys */
export const VERIFIED_SIGNALS: (keyof TrustSignals)[] = [
  "content_credentials", "trust_project", "jti_certified", "ifcn_signatory",
];

/** Values alignment signal keys */
export const VALUES_SIGNALS: (keyof TrustSignals)[] = [
  "creative_commons", "not_by_ai", "indieweb",
];

/** All trust signal keys (excluding metadata keys starting with _) */
export const ALL_TRUST_KEYS: (keyof TrustSignals)[] = [
  ...VERIFIED_SIGNALS, ...VALUES_SIGNALS, "editorial_standards_url",
];

type DetectionRule = {
  key: keyof TrustSignals;
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
      return "licensed"; // licensebuttons.net matched without capture group — return descriptive string, not boolean
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

/**
 * Fetch homepage HTML and detect trust signals.
 * Returns {_enrichment_failed: true} on failure (network error, timeout, etc.)
 * so the caller can distinguish "no signals found" from "couldn't check."
 */
export async function detectTrustSignals(siteUrl: string): Promise<TrustSignals> {
  if (!siteUrl) return { _enrichment_failed: true };

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

    clearTimeout(timer);

    if (!response.ok) return { _enrichment_failed: true };

    const html = await response.text();
    const signals: TrustSignals = {};

    for (const rule of DETECTION_RULES) {
      for (const pattern of rule.patterns) {
        const match = html.match(pattern);
        if (match) {
          if (rule.extractor) {
            const extracted = rule.extractor(match, html);
            if (extracted) {
              (signals as Record<string, unknown>)[rule.key as string] = extracted;
            }
          } else {
            (signals as Record<string, unknown>)[rule.key as string] = true;
          }
          break;
        }
      }
    }

    return signals;
  } catch {
    return { _enrichment_failed: true };
  }
}

/**
 * Merge trust signals into existing independence_signals jsonb.
 * Preserves existing keys, overwrites trust signal keys.
 * Marks _enrichment_attempted to prevent re-enrichment (even on failure).
 */
export function mergeTrustSignals(
  existingSignals: Record<string, unknown> | null,
  trustSignals: TrustSignals
): Record<string, unknown> {
  return {
    ...(existingSignals ?? {}),
    ...trustSignals,
    _enrichment_attempted: true,
  };
}
