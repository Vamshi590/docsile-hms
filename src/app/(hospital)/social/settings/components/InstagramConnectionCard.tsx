// src/app/(hospital)/social/settings/components/InstagramConnectionCard.tsx
"use client"
import { Button } from "@/components/ui/button"
import { disconnectInstagram } from "../actions"

export function InstagramConnectionCard(props: { connected: boolean; igUserId: string | null; connectedAt: string | null }) {
  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className="font-medium">Instagram Account</div>
      {props.connected ? (
        <>
          <div className="text-sm text-zinc-600">
            Connected (IG user id: <code>{props.igUserId}</code>)
            {props.connectedAt && <> · since {new Date(props.connectedAt).toLocaleDateString()}</>}
          </div>
          <form action={async () => { await disconnectInstagram() }}>
            <Button type="submit" variant="outline">Disconnect</Button>
          </form>
        </>
      ) : (
        <>
          <div className="text-sm text-zinc-600">Not connected.</div>
          <Button asChild>
            <a href="/api/social/instagram/connect">Connect Instagram</a>
          </Button>
        </>
      )}
    </div>
  )
}
