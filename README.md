This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Social Module (Instagram)

The `/social` module requires these env vars:

| Var | Notes |
|---|---|
| `META_APP_ID` | Facebook App ID |
| `META_APP_SECRET` | Facebook App secret |
| `META_OAUTH_REDIRECT_BASE` | Base URL (no trailing slash); callback is `${BASE}/api/social/instagram/callback` |
| `GEMINI_API_KEY` | Already used elsewhere; reused for content + vision |
| `GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash` |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32-byte base64. Generate: `openssl rand -base64 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for server-side storage writes |

**One-time setup**:
1. Create the `social-posts` public bucket in Supabase Storage.
2. Run the schema migration: `psql "$SUPABASE_DB_URL" -f prisma/migrations/social-module.sql`.
3. Backfill ADMIN role permissions: `yarn migrate:social-admin`.
4. Set the Meta App OAuth Redirect URI to `${META_OAUTH_REDIRECT_BASE}/api/social/instagram/callback`.
5. Submit the Meta App for review (`instagram_content_publish`, `pages_manage_posts`) before going live.

Manual QA: see `docs/superpowers/specs/2026-06-08-instagram-social-module-design.md`.
