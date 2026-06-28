# Instagram Automation

Standalone Vercel + Supabase app for scheduling Instagram Reels from public Supabase Storage URLs.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase Postgres for queue/account data
- Supabase Storage bucket `Instagram reels and clips storage` for public MP4 URLs
- Supabase Edge Functions for Meta publishing
- Supabase Cron plus `pg_net` for automatic scheduled runs

## Current Supabase Project

```text
Project URL: https://abnfrtvuxnuslmebcbca.supabase.co
Bucket: Instagram reels and clips storage
Example video: https://abnfrtvuxnuslmebcbca.supabase.co/storage/v1/object/public/Instagram%20reels%20and%20clips%20storage/venon-clip-1.mp4
```

The app starts with public video URLs. Browser upload to Supabase Storage is intentionally not part of v1.

## Meta App Mapping

```text
Primary publishing app: inkboost-IG
Primary publishing app ID: 873157062297648
Primary publishing account: ink_boost
Primary publishing IG user ID: 17841467513135062
Secondary accounts for later: edits_pro_studio, cliendly.in
```

V1 is manual-token-first. Save the Instagram business access token in Settings and let the publish worker use the stored `ig_user_id` plus `access_token` directly.

## Meta Values To Collect

```text
Meta app name
Meta app ID
Instagram user ID
Instagram business access token
Optional token expiry
```

## Not Used In V1

```text
Facebook app 890895456820829
Webhook subscriptions
Instagram messaging permissions
Comment moderation flows
OAuth callback handling
JavaScript SDK login
Deauthorize and data deletion callback flows
Automated app review setup
```

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abnfrtvuxnuslmebcbca.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=choose-a-dashboard-password
```

Open `http://localhost:3000`.

## Supabase Setup

Run the SQL files in this order:

```text
supabase/migrations/001_instagram_accounts.sql
supabase/migrations/002_scheduled_reels.sql
supabase/migrations/003_claim_due_reel.sql
supabase/migrations/005_recover_stuck_reels.sql
supabase/migrations/004_cron_publish_due_reels.sql
```

Before running `004_cron_publish_due_reels.sql`, save a Supabase Vault secret named:

```text
publish_worker_secret
```

The decrypted value must match the same value you set as the `PUBLISH_WORKER_SECRET` Edge Function secret. The cron SQL reads from Vault so the secret value does not live in repo-tracked files.

## Edge Function Setup

Function secrets:

```env
SUPABASE_URL=https://abnfrtvuxnuslmebcbca.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
META_GRAPH_VERSION=v21.0
PUBLISH_WORKER_SECRET=choose-a-worker-secret
```

Deploy the function from this folder:

```bash
supabase functions deploy publish-due-reel
```

The included `supabase/config.toml` disables JWT verification for this function. The function is protected by `x-worker-secret`, which cron sends.

The worker processes up to five due reels per invocation. If Meta accepts a video but keeps the container in `IN_PROGRESS`, the row returns to `scheduled` with its `meta_creation_id` saved, and the next cron run finishes publishing. Stuck `posting` rows older than 20 minutes are recovered automatically.

## One-Command Automation Activation

From this folder, export a Supabase personal access token in your shell, then run:

```bash
export SUPABASE_ACCESS_TOKEN=your-supabase-personal-access-token
set -a
source .env.local
set +a
./scripts/activate-supabase-automation.sh
```

The script deploys the Edge Function, sets function secrets, creates the Vault secret used by cron, and applies the automation SQL. It does not print secret values.

## Vercel Deployment

Create a Vercel project named:

```text
instagram-automation
```

Set the Vercel root directory to this folder:

```text
instagram automation
```

Set Vercel environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abnfrtvuxnuslmebcbca.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=choose-a-dashboard-password
```

Vercel hosts the dashboard/API routes only. Supabase runs the publish worker and cron.

## Automation Flow

```text
Dashboard schedules rows
Supabase Cron wakes every 5 minutes
Cron calls the publish-due-reel Edge Function
Worker recovers stuck rows and processes up to 5 due reels
Rows become posted, scheduled for another Meta-processing check, or failed with a readable error
```

You can close the dashboard after scheduling. Posting does not depend on the browser or Vercel staying open.

## First Manual Test

1. Add the `ink_boost` Instagram account in Settings.
2. Go to Dashboard.
3. Use the prefilled Venon Clip 1 URL.
4. Paste a caption.
5. Schedule for the current time.
6. Trigger the Edge Function or wait for cron.
7. Confirm the row becomes `posted` or `failed` with a useful error.

Recommended operating mode for v1:

```text
Keep one active publishing account until end-to-end posting is stable.
```

## Test Lab

Open `/test-lab` to run isolated checks without touching the reel scheduler.

Available tests:

```text
Test all saved Instagram account tokens
Publish one public image URL immediately
Upload a local image to Supabase Storage and copy its public URL
Publish the uploaded public image URL immediately
```

The default image URL is:

```text
https://abnfrtvuxnuslmebcbca.supabase.co/storage/v1/object/public/Instagram%20reels%20and%20clips%20storage/3d_delivery_box_parcel.jpg
```

Instant image publish creates a real Instagram post. The UI requires confirmation before calling Meta.

## Naming Note

Existing `venon-*` files are kept as-is for now. Future clips should use cleaner names like:

```text
venom-clip-001.mp4
venom-clip-002.mp4
venom-part-001.mp4
```
