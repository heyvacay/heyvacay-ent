import ApprovalDetail from './ApprovalDetail';

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApprovalDetail id={id} />;
}
