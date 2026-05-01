import { GuardClient } from "./guard-client";

export default async function GuardPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <GuardClient sessionId={sessionId} />;
}
