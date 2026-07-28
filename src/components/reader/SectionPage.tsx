import type { Tag } from "@/lib/compose-pages";

interface SectionPageProps {
  topics: Tag[];
}

export function SectionPage({ topics }: SectionPageProps) {
  if (topics.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 sm:px-12">
      {/* Top divider */}
      <div className="mb-10 h-px w-16 bg-zinc-800" />

      <h2 className="mb-8 text-xl font-medium tracking-wide text-zinc-100">
        In this issue
      </h2>

      <div className="flex max-w-lg flex-wrap justify-center gap-2">
        {topics.map((tag) => (
          <span
            key={tag.id}
            className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300"
          >
            {tag.name}
          </span>
        ))}
      </div>

      {/* Bottom divider */}
      <div className="mt-10 h-px w-16 bg-zinc-800" />
    </div>
  );
}
