# Internet Curators

**A portal to the internet on your terms.** Human-powered. No AI. No algorithms.

Curators replace the algorithm. Follow people whose taste you trust, scroll an Instagram-like feed, and control what you see. RSS-native, privacy-first, open source.

## How it works

1. **Curators** add RSS feeds to collections — blogs, news sites, anything with RSS
2. **Followers** scroll a familiar vertical feed of articles from curators they trust
3. **You moderate** — vote up, vote down, hide, remove sources. You shape your feed
4. **Publish when ready** — collections are private by default. Publish to share with followers
5. **Subscribe via RSS** — every published collection generates its own RSS feed

## Privacy by design

- Private collections: your reading data stays yours. Articles appear in the feed anonymously ("Trending") until you publish
- Public collections: you explicitly choose what to share. Curator credit only attached when you opt in
- Local storage: follows, votes, preferences never leave your device
- No tracking, no user data on any server

## Stack

Next.js 16 · TypeScript · Tailwind CSS · Supabase (auth + database) · RSS Parser

## AI-Augmented Development

This project is built by a solo designer using a three-agent AI stack:

| Role | Agent | Model |
|------|-------|-------|
| Orchestration | [Hermes](https://github.com/nousresearch/hermes-agent) | DeepSeek V4 Pro |
| Code | [OpenCode Go](https://opencode.ai) | `opencode-go/deepseek-v4-flash` |
| Audit & Review | [Claude Code](https://claude.ai) | Sonnet 4 |

Commits and PRs use `Co-authored-by:` trailers for transparency. See [.github/AGENT_ATTRIBUTION.md](.github/AGENT_ATTRIBUTION.md).

## POC Status

All phases complete. Deployed at [internet-curators.vercel.app](https://internet-curators.vercel.app).

- [x] Auth (email/password)
- [x] Database (curators, collections, sources)
- [x] Curator dashboard (create collections, add RSS sources, publish/draft toggle)
- [x] RSS pipeline (fetch, parse, deduplicate, merge)
- [x] Visitor homepage (feed + popular curators + search)
- [x] Follow system + voting
- [x] Private/public collections with two-tier feed attribution
- [x] Collection RSS output (published collections generate subscribable feeds)
- [x] Search (curator and collection search with tabbed suggestions)
- [x] Public curator profiles and collection pages
- [x] Deploy to Vercel

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in your Supabase URL and publishable key
npm run dev
```

Run migrations in `supabase/migrations/` in your Supabase SQL Editor (001, 002, 003).

## License

MIT
