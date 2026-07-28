import IssueReader from "@/components/reader/IssueReader";

export default async function ArchiveIssuePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  return <IssueReader issueNumber={number} />;
}
