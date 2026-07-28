export function ContextPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 sm:px-12">
      {/* Top divider */}
      <div className="mb-10 h-px w-16 bg-zinc-800" />

      <blockquote className="max-w-prose text-center">
        <p className="text-lg leading-relaxed tracking-wide text-zinc-100 sm:text-xl sm:leading-relaxed">
          An alternative tech magazine. Independent voices, underrated writers, comics,
          weird indie sites — anywhere critical thinking meets technology and
          how it touches everything. No algorithms, no hate — just curated human
          taste. New issue every day. 20 articles, start to finish.
        </p>
      </blockquote>

      {/* Bottom divider */}
      <div className="mt-10 h-px w-16 bg-zinc-800" />
    </div>
  );
}
