export function PostStatusBadge({ status }: { status: string }) {
  const cls = status === "posted" ? "bg-green-100 text-green-800"
    : status === "failed" ? "bg-red-100 text-red-800"
    : "bg-zinc-100 text-zinc-700"
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{status}</span>
}
