import { requireSocialEnv } from "./env"

const META_API = "https://graph.facebook.com/v22.0"

type MetaErr = { error?: { code: number; message: string } }

async function metaFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  const data = (await res.json()) as T & MetaErr
  if (data.error) {
    if (data.error.code === 190) throw new Error("TOKEN_EXPIRED")
    throw new Error(data.error.message)
  }
  if (!res.ok) throw new Error(`Meta API error ${res.status}`)
  return data
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; ig_user_id: string }> {
  const { META_APP_ID, META_APP_SECRET, META_OAUTH_CALLBACK } = requireSocialEnv()

  const { access_token: shortToken } = await metaFetch<{ access_token: string }>(
    `${META_API}/oauth/access_token?` + new URLSearchParams({
      client_id: META_APP_ID, client_secret: META_APP_SECRET,
      redirect_uri: META_OAUTH_CALLBACK, code,
    }),
  )

  const pagesData = await metaFetch<{
    data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>
  }>(`${META_API}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${shortToken}`)

  if (!pagesData.data?.length) {
    throw new Error("No Facebook Pages found. Make sure your account is the Admin of the page and you selected it during OAuth.")
  }
  const page = pagesData.data.find((p) => p.instagram_business_account?.id)
  if (!page?.instagram_business_account?.id) {
    throw new Error("None of your Facebook Pages have an Instagram Business account connected.")
  }
  const igUserId = page.instagram_business_account.id

  const { access_token: longUserToken } = await metaFetch<{ access_token: string }>(
    `${META_API}/oauth/access_token?` + new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: META_APP_ID, client_secret: META_APP_SECRET,
      fb_exchange_token: shortToken,
    }),
  )

  const neverExpires = await metaFetch<{ access_token: string }>(
    `${META_API}/${page.id}?fields=access_token&access_token=${longUserToken}`,
  )
  return { access_token: neverExpires.access_token ?? page.access_token, ig_user_id: igUserId }
}

export async function publishPost(igUserId: string, accessToken: string, imageUrl: string, caption: string): Promise<string> {
  const container = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, media_type: "IMAGE", caption, access_token: accessToken }),
  })
  const published = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
  })
  return published.id
}

export async function publishCarousel(igUserId: string, accessToken: string, imageUrls: string[], caption: string): Promise<string> {
  const containerIds: string[] = []
  for (const imageUrl of imageUrls) {
    const c = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, media_type: "IMAGE", is_carousel_item: true, access_token: accessToken }),
    })
    containerIds.push(c.id)
  }
  const carousel = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "CAROUSEL", children: containerIds.join(","), caption, access_token: accessToken }),
  })
  const published = await metaFetch<{ id: string }>(`${META_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carousel.id, access_token: accessToken }),
  })
  return published.id
}
