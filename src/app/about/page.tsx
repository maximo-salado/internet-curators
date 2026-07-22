import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      {/* Hero */}
      <section className="mb-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
          Curated reads from{" "}
          <span className="text-white">people who know</span>
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-zinc-400">
          Internet Curators brings taste back to the open web. Independent
          curators — journalists, researchers, and domain experts — hand-pick
          the articles worth your time.
        </p>
      </section>

      {/* What */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          What
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-zinc-300">
          A feed of articles curated by real people, not algorithms. Every link
          is chosen by someone with deep domain knowledge and a point of view.
          No engagement bait, no clickbait — just signal.
        </p>
      </section>

      {/* Why */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Why
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-zinc-300">
          The open web is rich but fragmented. Signal is scattered across
          newsletters, blogs, podcasts, and social feeds — buried under noise.
          Curators bring taste, context, and coherence. They do the sifting so
          you can do the reading.
        </p>
      </section>

      {/* How */}
      <section className="mb-16">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          How
        </h2>
        <ol className="mt-4 space-y-5">
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-300">
              1
            </span>
            <div>
              <h3 className="font-medium text-zinc-200">Discover curators</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                Browse curators by topic, follow the ones whose taste you
                trust. Every curator has a profile showing their sources and
                recent picks.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-300">
              2
            </span>
            <div>
              <h3 className="font-medium text-zinc-200">Follow sources</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                Add individual publications, blogs, and newsletters to your
                feed. Mix and match curator picks with direct sources.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-300">
              3
            </span>
            <div>
              <h3 className="font-medium text-zinc-200">Build your feed</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                Your personalized feed surfaces the best from everyone you
                follow. Upvote what resonates, hide what doesn&apos;t, and
                watch your feed get sharper.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* CTA */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-8 text-center">
        <h2 className="text-xl font-semibold text-zinc-100">
          Start reading with taste
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          No account needed to explore. Sign up to follow curators and build
          your personal feed.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Explore
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
          >
            Sign Up
          </Link>
        </div>
      </section>
    </div>
  );
}
