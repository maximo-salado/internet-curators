interface ClosingPageProps {
  count: number;
}

export default function ClosingPage({ count }: ClosingPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black text-zinc-100 select-none">
      <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
        {/* Heading */}
        <h1 className="text-5xl sm:text-6xl font-serif font-bold tracking-tight">
          {count > 0
            ? `You read ${count} article${count === 1 ? "" : "s"}.`
            : "That's the issue."}
        </h1>

        {/* Subtext */}
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
          RSSMag is curated by hand. No algorithms, no engagement
          hacks&mdash;just things worth reading from the open web.
        </p>

        {/* Links row */}
        <div className="flex items-center gap-6 pt-2">
          <a
            href="mailto:hello@rssmag.com"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-200 underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-400"
          >
            Get in touch
          </a>
          <a
            href="https://github.com/maximo-salado/internet-curators"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-200 underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-400"
          >
            GitHub
          </a>
        </div>

        {/* Final line */}
        <p className="text-sm text-zinc-400 pt-4">
          Come back tomorrow for a fresh issue.
        </p>
      </div>
    </div>
  );
}
