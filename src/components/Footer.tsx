import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-black px-4 py-8">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
        <p>
          &copy; {new Date().getFullYear()} Internet Curators
        </p>
        <p>
          Want your site removed?{" "}
          <a
            href="mailto:contact@internet-curators.vercel.app"
            className="text-zinc-400 underline hover:text-zinc-200 transition-colors"
          >
            Email us
          </a>
        </p>
      </div>
    </footer>
  );
}
