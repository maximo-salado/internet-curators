export default function ShelfLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-[100dvh] bg-black text-zinc-100" style={{ overflow: "visible" }}>
      {children}
    </div>
  );
}
