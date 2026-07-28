import { editorConfig } from "@/lib/editor-config";

export default function EditorPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-black text-zinc-100 px-6">
      {/* Avatar placeholder */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-zinc-700">
        <span className="select-none text-2xl font-medium text-zinc-300">
          {editorConfig.name.charAt(0)}
        </span>
      </div>

      {/* Editor name */}
      <h2 className="text-xl font-semibold tracking-tight">
        {editorConfig.name}
      </h2>

      {/* Editor note */}
      <p className="max-w-prose text-center text-sm leading-relaxed text-zinc-400">
        {editorConfig.note}
      </p>
    </div>
  );
}
