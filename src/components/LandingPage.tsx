import Link from "next/link";

const GITHUB_URL = "https://github.com/maximo-salado/internet-curators";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* Hero */}
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Your internet,{" "}
          <span className="text-zinc-400">curated by people you trust</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400 leading-relaxed">
          Internet Curators replaces the algorithm with human taste. Follow
          curators who share what they love, scroll a familiar feed, and
          subscribe to their collections via RSS. No AI. No tracking. Just
          people pointing at the good stuff.
        </p>
        <div className="mt-10">
          <Link
            href="/feed"
            className="inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors"
          >
            Browse the feed →
          </Link>
        </div>
      </section>

      {/* What makes it different */}
      <section className="border-t border-zinc-800 py-20">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center text-2xl font-semibold">
            Why Internet Curators?
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            <Feature
              title="Human-powered, not algorithmic"
              description="Every article in your feed was chosen by a real person. No engagement optimization, no rage-bait, no mystery boxes."
            />
            <Feature
              title="Privacy by design"
              description="Your follows, votes, and reading preferences stay on your device. We don't track you, profile you, or sell your data."
            />
            <Feature
              title="RSS-native"
              description="Every published collection generates its own RSS feed. Subscribe in any reader, on any device, without an account."
            />
            <Feature
              title="Open source"
              description="The code is public. The platform is transparent. You can run your own instance or contribute to the project."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800 py-20">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center text-2xl font-semibold">How it works</h2>
          <div className="mt-12 space-y-12">
            <Step
              number="1"
              title="Create collections"
              description="Add RSS feeds from your favorite blogs, news sites, and publications. Organize them into collections like 'Design', 'Politics', or 'Indie Music'."
            />
            <Step
              number="2"
              title="Publish when ready"
              description="Collections start private. When you're happy with your curation, publish it. Only then does your name appear — no data leaks."
            />
            <Step
              number="3"
              title="Follow curators"
              description="Discover curators whose taste you trust. Their published collections flow into your feed. Vote up what you like, hide what you don't."
            />
            <Step
              number="4"
              title="Subscribe anywhere"
              description="Every published collection has an RSS feed. Subscribe in Feedly, NetNewsWire, or any RSS reader. Curate once, read everywhere."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-2xl px-6 flex items-center justify-between text-sm text-zinc-500">
          <span>Internet Curators</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-sm font-medium text-zinc-400">
        {number}
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
