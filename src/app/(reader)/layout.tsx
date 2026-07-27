export default function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-black text-zinc-100">
      {children}
    </div>
  );
}
