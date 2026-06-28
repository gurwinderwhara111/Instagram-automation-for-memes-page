# UNIVERSAL WEBHOOK SYSTEM — Complete Guide

### For Developers, AI Agents, and Anyone Using This Folder

---

## 🤖 QUICKSTART FOR AI AGENTS (READ & RUN IMMEDIATELY)

If you are an AI coding agent (like Antigravity, Claude, or ChatGPT) that has just been initialized or dropped into this workspace:

**DO NOT HALLUCINATE OR TRY TO RECREATE A WEBHOOK ROUTER. THIS WORKSPACE CONTAINS THE PORTABLE TUNNEL CONNECTOR FOR A PRE-EXISTING WEBHOOK GATEWAY.**

Here are your exact step-by-step instructions to connect this local workspace to receive live Instagram/Meta webhooks:

### 1. Identify the Main App Port

Look at the files in the workspace root. Find the server setup file (e.g., `index.js`, `app.js`, `main.py`, `server.go`). Identify the port the application is listening on.

- **By default, this tunnel assumes your local app runs on port `3000`.**
- If it runs on a different port (e.g., `5000` or `8080`), you must specify it when running the tunnel command below.

### 2. Launch the Cloudflare Tunnel Connector

You must start the Cloudflare tunnel in the background as a task/process. This tunnel maps incoming webhooks from `https://bot.mymua.in` directly to your local port.

- **On Windows (Powershell/Cmd):**
  ```powershell
  cd tunnel
  .\setup.bat 3000
  ```
- **On Linux / GitHub Codespaces:**
  ```bash
  cd tunnel
  bash setup.sh 3000
  ```
  _(Replace `3000` with the actual port of your local bot server if different)._

### 3. Keep the Tunnel Connector Running

- **Do NOT terminate the background task running `setup.bat` or `setup.sh`.**
- If the tunnel task is killed, your local workspace will immediately stop receiving webhooks (calls to `https://bot.mymua.in` will return `502 Bad Gateway`).
- The script has a built-in auto-restart feature if the network drops.

### 4. Code Your App to Accept Webhooks

You must configure your local application to listen for webhooks. Due to Cloudflare preserving path routes, you must handle:

- `POST /` (for Instagram DMs/Messages)
- `POST /api/webhook` (for Instagram Comments, Live Comments, Scheduler Media, and WhatsApp)
- The webhook payload will be identical to the Meta Graph API schema.

### 5. Meta Webhook Signature Verification is Bypassed locally

- The central gateway `https://webhook.mymua.in` already validates the signatures using the secret `META_APP_SECRET`.
- When forwarding requests, it attaches a custom header `X-Meta-Signature-256` containing the original signature.
- **Do not request or try to configure Vercel env variables, `APP_SECRET`, or `APP_ID` in this local project workspace unless you are coding outgoing message replies.**

---

## ⚠️ READ THIS FIRST — Before You Touch Anything

This repository is a **central webhook gateway**. It is **NOT** your actual Instagram bot, scheduler, or followup tool. It is the **traffic controller** that sits between Meta and all your real projects.

**You do NOT need to:**

- Create a new Meta App for every new project ❌
- Add Meta credentials (`APP_ID`, `APP_SECRET`) to every new project ❌
- Change the Meta webhook URL when switching projects ❌
- Understand Cloudflare internals to use this ❌

**You ONLY need to:**

- Keep `webhook.mymua.in` pointed at your project's URL ✅
- Run the tunnel script when developing locally ✅

---

## 🏗️ What Is This System? (The Big Picture)

You have **one Meta App** (`inkboost-IG`, App ID `873157062297648`) connected to Instagram.

Meta sends **all** webhook events (DMs, Comments, Media posts, Live comments) to ONE permanent URL:

```
https://webhook.mymua.in/api/webhook
```

This URL is hosted on **Vercel** (this repository). It:

1. **Verifies** the signature (checks it's really from Meta, not a hacker)
2. **Reads** the payload to figure out what type of event it is
3. **Forwards** it to whichever project/tool should handle it

```
┌─────────────────────────────────────────────────────────────────────┐
│                     THE COMPLETE FLOW                               │
│                                                                     │
│  Instagram User                                                     │
│       │  (sends DM, comments, reacts, etc.)                        │
│       ▼                                                             │
│  META SERVERS                                                       │
│       │  POST https://webhook.mymua.in/api/webhook                 │
│       │  with x-hub-signature-256 header                           │
│       ▼                                                             │
│  VERCEL (this repo — webhook.mymua.in)                              │
│       │  1. Verifies HMAC-SHA256 signature using META_APP_SECRET    │
│       │  2. Reads payload object + field                            │
│       │  3. Looks up target URL from env vars                       │
│       │  4. Forwards payload via HTTPS POST                         │
│       ▼                                                             │
│  YOUR PROJECT (wherever it lives)                                   │
│       │  Can be:                                                    │
│       │  - localhost:3000 via Cloudflare Tunnel (development)       │
│       │  - Any Vercel project URL (production)                      │
│       │  - Railway, Render, Fly.io, any public URL                  │
│       ▼                                                             │
│  Your bot/scheduler/tool receives the Instagram payload             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Credentials Are Already Handled

**This is the most important thing to understand:**

All Meta credentials live **inside this Vercel project** (`webhook.mymua.in`), NOT in your individual projects.

| Credential                         | Where It Lives          | Your Projects Need It?    |
| ---------------------------------- | ----------------------- | ------------------------- |
| `META_APP_SECRET`                  | Vercel env → this repo  | ❌ NO                     |
| `META_APP_ID`                      | Vercel env → this repo  | ❌ NO                     |
| `META_VERIFY_TOKEN`                | Vercel env → this repo  | ❌ NO                     |
| Access Token (for sending replies) | Your own project `.env` | ✅ YES — to SEND messages |

> **Note:** Your projects need the **Access Token** only when they want to **send** replies back to Instagram via the Graph API. For **receiving** webhooks, you need nothing — Vercel handles it all.

---

## 🗺️ How the Router Decides Where to Send Events

The Vercel router (`lib/router.js`) reads the Meta payload and routes based on event type:

| Instagram Event                       | Goes To Env Var                     | Default Target                     |
| ------------------------------------- | ----------------------------------- | ---------------------------------- |
| DM / Direct Message (`messaging`)     | `TUNNEL_IG_BOT`                     | `https://bot.mymua.in`             |
| Comment on post/reel (`comments`)     | `TUNNEL_IG_FOLLOWUP`                | `https://bot.mymua.in/api/webhook` |
| Media / Post published (`media`)      | `TUNNEL_IG_SCHEDULER`               | `https://bot.mymua.in/api/webhook` |
| Live stream comment (`live_comments`) | `TUNNEL_IG_FOLLOWUP`                | `https://bot.mymua.in/api/webhook` |
| WhatsApp message                      | `TUNNEL_WHATSAPP`                   | `https://bot.mymua.in/api/webhook` |
| Facebook Page / Messenger             | `TUNNEL_MESSENGER`                  | `https://bot.mymua.in/api/webhook` |
| Explicit `?tool=name` in URL          | `TUNNEL_{NAME}`                     | Looks up by tool name              |
| Unknown / fallback                    | `TUNNEL_DEFAULT` or `TUNNEL_IG_BOT` | `https://bot.mymua.in`             |

**You can override routing** by calling the webhook with a `?tool=` query parameter:

```
https://webhook.mymua.in/api/webhook?tool=scheduler
```

This forces all events from that call to go to `TUNNEL_IG_SCHEDULER`.

---

## 📁 Files in This Tunnel Folder

```
tunnel/
├── setup.bat      ← Run this on Windows to start the tunnel
├── setup.sh       ← Run this on Linux / Mac / GitHub Codespace
├── token.txt      ← Cloudflare tunnel auth token (keep this safe, never share)
└── GUIDE.md       ← This file
```

### What Each File Does:

**`setup.bat` / `setup.sh`**

- Downloads `cloudflared` automatically if not installed
- Reads the token from `token.txt`
- Connects `https://bot.mymua.in` → `http://localhost:3000` on your machine
- Auto-restarts if the connection drops

**`token.txt`**

- A base64-encoded JWT that authenticates this machine to Cloudflare
- It connects to the **`universal webhook tunnel`** configured in Cloudflare
- Do NOT regenerate this unless you know what you are doing
- If it stops working, go to: **Cloudflare Dashboard → Protect & Connect → Tunnels → universal webhook tunnel** → get new token

---

## 🖥️ SCENARIO A: Local Development (Codespace or PC)

**Use this when:** You are writing code and want to receive real Instagram webhooks on your machine while you develop.

### How It Works:

```
Meta → webhook.mymua.in (Vercel) → bot.mymua.in (Cloudflare) → localhost:3000 (your machine)
```

### ⚠️ CRITICAL — How Cloudflare Preserves URL Paths

The Cloudflare tunnel is configured as:

```
bot.mymua.in  →  http://localhost:3000
```

Cloudflare **preserves the URL path**. Whatever path is after `bot.mymua.in` gets forwarded to the same path on `localhost:3000`:

| Vercel forwards to                 | Cloudflare routes to                |
| ---------------------------------- | ----------------------------------- |
| `https://bot.mymua.in` (root)      | `http://localhost:3000/`            |
| `https://bot.mymua.in/api/webhook` | `http://localhost:3000/api/webhook` |

Looking at the current Vercel env vars:

```
TUNNEL_IG_BOT      = https://bot.mymua.in           → your app gets POST at /
TUNNEL_IG_FOLLOWUP = https://bot.mymua.in/api/webhook → your app gets POST at /api/webhook
TUNNEL_IG_SCHEDULER= https://bot.mymua.in/api/webhook → your app gets POST at /api/webhook
```

**This means your local bot app MUST handle BOTH routes:**

- `POST /` → for Instagram DMs and Messages
- `POST /api/webhook` → for Comments, Media, Live Comments, WhatsApp

If your app only listens on ONE route, some events will be missed.

**The easiest fix** — make your app handle both paths, or update ALL TUNNEL vars to use the same path:

```bash
# Option A: Update all tunnel vars to use /api/webhook
echo "https://bot.mymua.in/api/webhook" | npx vercel env add TUNNEL_IG_BOT production --force
npx vercel --prod

# Then your app only needs: POST /api/webhook
```

### Step-by-Step:

**Step 1: Start your actual project on port 3000**

```bash
# Python
python app.py        # must listen on port 3000

# Node.js
node index.js        # must listen on port 3000

# Or whatever your project uses
npm run dev          # if it uses port 3000
```

**Step 2: Start the tunnel**

On **Windows**:

```cmd
cd tunnel
setup.bat
```

On **Linux / Mac / GitHub Codespace**:

```bash
cd tunnel
bash setup.sh
```

You should see:

```
==============================================
  Universal Webhook - Tunnel Connector
==============================================
  App:   your-app
  Port:  3000
  Host:  https://bot.mymua.in

[2/3] Connecting tunnel...
  Registered tunnel connection
```

**Step 3: Instagram events now hit your localhost**

That's it. No Meta changes needed. No Vercel changes needed.
Any DM someone sends to your Instagram now flows:

```
Instagram → Meta → webhook.mymua.in → Cloudflare → your localhost:3000
```

### ✅ Rules for Local Development Mode:

- Your app **MUST** listen on `http://localhost:3000` (or pass a different port: `setup.bat 8080`)
- Your app **MUST** accept `POST` requests with `Content-Type: application/json`
- Your app **MUST** respond `200 OK` within 5 seconds
- The tunnel terminal window **MUST** stay open (closing it = no webhooks)
- Only **one machine** can run the tunnel at a time (the last one to connect wins)

### ❌ Common Mistakes in Local Mode:

| Mistake                             | Fix                                                           |
| ----------------------------------- | ------------------------------------------------------------- |
| App is on port 5000, not 3000       | Run `setup.bat 5000`                                          |
| Closed the tunnel terminal          | Reopen and run `setup.bat` again                              |
| App crashes after receiving webhook | Log the raw body first, check error                           |
| Nothing arrives at localhost        | Check Vercel env var `TUNNEL_IG_BOT` = `https://bot.mymua.in` |
| 502 Bad Gateway from bot.mymua.in   | Your app is NOT running on port 3000                          |

---

## 🚀 SCENARIO B: Deploying Your Project Live on Vercel (or Any Host)

**Use this when:** Your project is ready and you want to deploy it permanently. No more tunnel needed.

### How It Works:

```
Meta → webhook.mymua.in (Vercel) → your-deployed-app.vercel.app (direct)
```

No Cloudflare tunnel. No localhost. Webhooks go straight from Vercel to your deployed URL.

### Step-by-Step:

**Step 1: Deploy your project to Vercel (or anywhere)**

You can deploy to:

- Vercel (any account, not just the one hosting `webhook.mymua.in`)
- Railway
- Render
- Fly.io
- Any public URL

Your deployed project gets a URL like `https://my-ig-bot.vercel.app`.

**Step 2: Update the Vercel env var on THIS repo**

Go to the `webhook.mymua.in` Vercel project (this repo) and update the env var for which project type you deployed:

| If you deployed your... | Update this env var   | To this value                     |
| ----------------------- | --------------------- | --------------------------------- |
| Instagram DM bot        | `TUNNEL_IG_BOT`       | `https://my-ig-bot.vercel.app`    |
| Comment followup bot    | `TUNNEL_IG_FOLLOWUP`  | `https://my-followup.vercel.app`  |
| Video scheduler         | `TUNNEL_IG_SCHEDULER` | `https://my-scheduler.vercel.app` |
| WhatsApp bot            | `TUNNEL_WHATSAPP`     | `https://my-wa-bot.vercel.app`    |

Using the CLI:

```bash
# From this repo folder (vercel recover)
echo "https://my-ig-bot.vercel.app" | npx vercel env add TUNNEL_IG_BOT production
npx vercel --prod
```

> [!IMPORTANT]
>
> ### 🛑 WHY WE DO NOT UPDATE ENV VARS ON YOUR NEW PROJECT (E.G. IMAGESUPLOADER)
>
> A common point of confusion for both developers and AI agents is trying to configure the webhook routing by adding environment variables directly to the _newly deployed project_ (for example, `https://imagesuploader.vercel.app`).
>
> **Why this will NOT work:**
>
> - When an Instagram event occurs, Meta sends an HTTP POST request to the central gateway: `https://webhook.mymua.in/api/webhook`.
> - The central gateway `webhook.mymua.in` must make an outgoing request to forward the payload.
> - If you only configure environment variables on `imagesuploader.vercel.app`, the central gateway has **no way of knowing** that `imagesuploader` exists, nor does it know its URL.
> - Therefore, you **must always update the environment variables of the central gateway (`webhook.mymua.in`)** so it knows where to send the events. You do not configure these routing variables inside the client projects themselves.

**Step 3: Redeploy this Vercel project**

```bash
npx vercel --prod
```

**Step 4: Test**

Instagram DMs will now flow:

```
Instagram → Meta → webhook.mymua.in → your-deployed-app.vercel.app
```

**No tunnel. No localhost. Fully production.**

### ✅ Rules for Production Deployment Mode:

- Your deployed app must have a **public HTTPS URL**
- Your app must accept `POST` requests at whatever path you set as the env var value
  - Example: `TUNNEL_IG_BOT = https://my-app.vercel.app/webhook` → posts go to `/webhook`
  - Example: `TUNNEL_IG_BOT = https://my-app.vercel.app` → posts go to root `/`
- You do NOT need `META_APP_SECRET` or `META_APP_ID` in your deployed project
- After updating env vars, always redeploy this repo (`npx vercel --prod`)

### ❌ Common Mistakes in Production Mode:

| Mistake                                                             | Fix                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| Forgot to redeploy after changing env var                           | Run `npx vercel --prod` in this repo                     |
| Set wrong path in env var                                           | Make sure path matches your app's POST route             |
| Set `TUNNEL_IG_BOT` to your project but events go to comments route | Use `TUNNEL_IG_FOLLOWUP` for comments                    |
| Your deployed app returns non-200                                   | Forwarder retries 3 times then logs to dead-letter queue |

---

## 🔄 Switching Between Local and Production

The magic of this system is that switching is just **one env var update**:

**Going from Production → Local Dev:**

```bash
echo "https://bot.mymua.in" | npx vercel env add TUNNEL_IG_BOT production --force
npx vercel --prod
# Then run: setup.bat in the tunnel folder
```

**Going from Local Dev → Production:**

```bash
echo "https://your-deployed-app.vercel.app" | npx vercel env add TUNNEL_IG_BOT production --force
npx vercel --prod
# No tunnel needed
```

---

## 🧩 Architecture Deep Dive

### Files That Make This Work (in the main repo):

```
api/
└── webhook.js         ← THE MAIN HANDLER
                         - Verifies HMAC-SHA256 signature (rejects fakes with 401)
                         - Reads raw body as Buffer (critical for correct HMAC)
                         - Parses JSON payload
                         - Calls router → forwarder

lib/
├── verifier.js        ← Signature verification
│                        Uses META_APP_SECRET from Vercel env
│                        Returns true if no secret set (bypass mode)
│
├── router.js          ← Traffic director
│                        Reads payload.object + entry.changes.field
│                        Returns the target URL from env vars
│
├── forwarder.js       ← HTTP forwarder with retry
│                        3 attempts with 1s/2s/3s delays
│                        5 second timeout per attempt
│                        Passes original signature header along
│
└── dead-letter.js     ← Failure safety net
                         If all 3 forward attempts fail:
                         Logs to console + saves to Vercel KV database
                         You can replay failed payloads later

config/
└── routes.json        ← Tool → env var mapping
                         Maps tool names (bot, followup, scheduler)
                         to their Vercel env var names
```

### Vercel Environment Variables (in this repo):

```
META_VERIFY_TOKEN    = inkboost_verify_2024       (Meta webhook handshake)
META_APP_SECRET      = c68ac4dbb42514f66853b3c4e507b983  (HMAC verification)
META_APP_ID          = 873157062297648            (OAuth, if used)
KV_REST_API_URL      = [Vercel KV URL]            (Dead-letter storage)
KV_REST_API_TOKEN    = [Vercel KV token]          (Dead-letter storage)

TUNNEL_IG_BOT        = https://bot.mymua.in       (DMs → here)
TUNNEL_IG_FOLLOWUP   = https://bot.mymua.in/api/webhook   (Comments → here)
TUNNEL_IG_SCHEDULER  = https://bot.mymua.in/api/webhook   (Media → here)
TUNNEL_WHATSAPP      = https://bot.mymua.in/api/webhook   (WhatsApp → here)
TUNNEL_MESSENGER     = https://bot.mymua.in/api/webhook   (FB Page → here)
TUNNEL_DEFAULT       = (fallback if nothing else matches)
```

### Meta Dashboard Settings (DO NOT CHANGE):

```
App Name         : inkboost-IG
App ID           : 873157062297648
Callback URL     : https://webhook.mymua.in/api/webhook   ← NEVER CHANGE THIS
Verify Token     : inkboost_verify_2024                   ← NEVER CHANGE THIS

Subscribed Fields:
  ✅ messages
  ✅ comments
  ✅ live_comments
  ✅ message_reactions
  ✅ messaging_optins
  ✅ messaging_postbacks
  ✅ messaging_seen
  ✅ message_edit
```

---

## 🤖 Guide for AI Agents Using This System

If you are an AI agent helping with a project that uses this webhook system, read this section carefully.

### Rule 1: Never Change the Meta Dashboard

The Meta webhook callback URL (`https://webhook.mymua.in/api/webhook`) is permanent. Do NOT tell the user to change it. Do NOT create a new Meta App. Do NOT create a new webhook configuration.

### Rule 2: The Two URLs — Which One to Use

There are two webhook-related URLs. Do not confuse them:

| URL                                    | What It Is                    | When to Use                                                            |
| -------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `https://webhook.mymua.in/api/webhook` | The Vercel router (this repo) | Set this in Meta Dashboard. Never change.                              |
| `https://bot.mymua.in`                 | The Cloudflare tunnel         | Used only for local/Codespace development. Changes when tunnel is off. |

**Never set `bot.mymua.in` as the Meta webhook URL.** It only works when the tunnel is actively running.

### Rule 3: To Add a New Project

You only need to update ONE env var in the `webhook.mymua.in` Vercel project:

```bash
# Example: user built a new Instagram bot at https://new-bot.vercel.app
echo "https://new-bot.vercel.app" | npx vercel env add TUNNEL_IG_BOT production --force
npx vercel --prod
```

That's it. No Meta changes. No new credentials.

### Rule 4: Security

The `api/webhook.js` file has `bodyParser: false` exported but this only works in Next.js. In plain Vercel functions, the raw body is read directly from the stream. **Do not change the body reading logic in `api/webhook.js`** — it is specifically written to get exact raw bytes for correct HMAC verification.

### Rule 5: Testing

To test if the webhook is working, run:

```bash
node scripts/test.js
```

Or run the full battery test. A `200 OK` response means the signature was accepted. A `401` means something is wrong with `META_APP_SECRET`.

---

## 🔧 Troubleshooting Reference

| Problem                                    | What to Check                          | Fix                                                                                             |
| ------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tunnel says `connection refused`           | Is your app running?                   | Start your app on port 3000 first                                                               |
| `502 Bad Gateway` at `bot.mymua.in`        | Is the tunnel running?                 | Run `setup.bat` in the tunnel folder                                                            |
| `401 Unauthorized` in Vercel logs          | Is `META_APP_SECRET` correct?          | Check Vercel env vars match Meta Dashboard App Secret                                           |
| Webhooks not arriving at all               | Is Meta subscribed?                    | Meta Dashboard → Webhooks → check subscriptions                                                 |
| Webhooks arrive at Vercel but not your app | Is the TUNNEL\_\* env var correct?     | Check Vercel env var points to correct URL                                                      |
| `TUNNEL_IG_BOT` is undefined in logs       | Env var not set or not deployed        | Set it and run `npx vercel --prod`                                                              |
| Dead-letter errors in logs                 | Your app was down when webhook arrived | Check Vercel KV for saved payloads to replay                                                    |
| Tunnel keeps disconnecting                 | WiFi/network issue                     | Script auto-restarts. Check your internet.                                                      |
| `token.txt not found`                      | Wrong folder                           | Make sure `token.txt` is in the `tunnel/` folder                                                |
| `403 Forbidden` from cloudflared           | Token expired                          | Regenerate at **Cloudflare Dashboard → Protect & Connect → Tunnels → universal webhook tunnel** |

---

## 📋 Quick Reference Card

### Starting Local Dev (Copy-paste this):

```cmd
REM Step 1: Start your project
npm run dev        <- or python app.py, etc. Must be on port 3000

REM Step 2: In a new terminal, start tunnel
cd "d:\download\vercel recover\tunnel"
setup.bat

REM Done. Instagram events now hit your localhost:3000
```

### Deploying to Production (Copy-paste this):

```bash
# Step 1: Deploy your project somewhere
# (Get its public URL, e.g. https://my-bot.vercel.app)

# Step 2: Update this repo's env var (run from this repo folder)
echo "https://my-bot.vercel.app" | npx vercel env add TUNNEL_IG_BOT production --force

# Step 3: Redeploy this router
npx vercel --prod

# Done. Instagram events now go to your deployed app. No tunnel needed.
```

### Checking Everything Works:

```bash
# From this repo folder
node scripts/test.js

# Should output: HTTP 200 OK - Signature verification PASSED
```

---

## 🌐 Important Links

| Resource                    | URL                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| This repo on Vercel         | https://vercel.com/universal-webhook/universal-webhook                                    |
| Webhook endpoint            | https://webhook.mymua.in/api/webhook                                                      |
| Tunnel public URL           | https://bot.mymua.in                                                                      |
| Meta Developer Console      | https://developers.facebook.com/apps/873157062297648                                      |
| Cloudflare Tunnel Dashboard | https://one.dash.cloudflare.com/ → Protect & Connect → Tunnels → universal webhook tunnel |
| GitHub Repo                 | https://github.com/gurwinderwhara111/universal-webhook                                    |

---

_Last verified: June 2026 | All 11 webhook scenarios tested and passing | End-to-end chain confirmed working_
