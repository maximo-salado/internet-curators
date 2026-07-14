# Internet Curators

**A portal to the internet on your terms.** Human-powered. No AI. No algorithms.

Curators replace the algorithm. Follow people whose taste you trust, scroll an Instagram-like feed, and control what you see. RSS-native, privacy-first, open source.

## How it works

1. **Curators** add RSS feeds to collections — blogs, news sites, anything with RSS
2. **Followers** scroll a familiar vertical feed of articles from curators they trust
3. **You moderate** — vote up, vote down, hide, remove sources. You shape your feed

## Stack

Next.js 16 · TypeScript · Tailwind CSS · Supabase (auth + database) · RSS Parser

## POC Status

Phases 1-7 complete. Live demo coming soon.

- [x] Auth (email/password)
- [x] Database (curators, collections, sources)
- [x] Curator dashboard (create collections, add RSS sources)
- [x] RSS pipeline (fetch, parse, deduplicate, merge)
- [x] Visitor homepage (feed + popular curators + search)
- [x] Follow system + voting
- [ ] Deploy to Vercel

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in your Supabase URL and publishable key
npm run dev
```

Run the migration in `supabase/migrations/001_schema.sql` in your Supabase SQL Editor.

## Privacy

- Public data (Supabase): curator profiles, collections, RSS sources, follower counts (number only)
- Private data (localStorage, never leaves your device): follows, votes, preferences
- No user data on any server, ever

## License

MIT
