export default function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="fixed inset-0 bg-black text-zinc-100">
      {children}
    </div>
  );
}
