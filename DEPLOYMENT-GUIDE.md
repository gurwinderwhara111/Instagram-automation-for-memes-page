# Vercel Deployment Troubleshooting Guide

## The Core Problem

```
Vercel project owner  ≠  GitHub Codespace user  ≠  Git commit author
```

Three separate identities can cause deployment failures:

| Identity | Purpose | Example |
|----------|---------|---------|
| **Vercel Account** | Owns the Vercel project (`gurwinderwhara777-1536`) | Login via GitHub OAuth |
| **GitHub Repo Owner** | Owns the git repo (`gurwinderwhara111`) | Has push access |
| **Codespace User** | Runs the local dev environment (`thegurwinder134-stack`) | May not have push access |

---

## Problem 1: Git Push Fails (403 Forbidden)

### Error
```
remote: Permission to userA/repo.git denied to userB.
fatal: unable to access '...': The requested URL returned error: 403
```

### Why
The Codespace is logged in as GitHub user `B`, but the repo belongs to user `A`. `B` is not a collaborator.

### Solutions

**Option A** — Add Codespace user as collaborator (best for teams)
1. Go to **GitHub → repo → Settings → Collaborators → Add people**
2. Add the Codespace's GitHub username with **Write** access
3. Now `git push` works

**Option B** — Use Personal Access Token (PAT) from repo owner
```
git remote set-url origin https://OWNER:TOKEN@github.com/OWNER/REPO.git
```
Get token from: **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**

**Option C** — Push from local machine
```bash
git push origin main
```
Run this on the machine where you're logged into the correct GitHub account.

---

## Problem 2: Vercel CLI Deploy Blocked — "commit email could not be matched"

### Error
```
The deployment was blocked because the commit email user@gmail.com 
could not be matched to a Git account.
```

### Why
Vercel CLI reads your git config email and tries to match it to a known GitHub/Vercel account. If the emails don't match, deployment is blocked.

Free (Hobby) plans **require** the git email to match the Vercel account's GitHub email.

### Solution
```bash
# 1. Find your Vercel account's GitHub email
# Check at: Vercel Dashboard → Settings → Git

# 2. Set git config to match
git config --global user.email "your-vercel-github-email@example.com"

# 3. Re-commit or amend
git commit --amend --reset-author --no-edit
# OR make a new commit
git commit --allow-empty -m "fix git email"

# 4. Push
git push origin main --force
```

### Alternative — Deploy via Git (not CLI)
Push to GitHub and let Vercel's **Git Integration** auto-deploy. This bypasses the CLI email check entirely.

---

## Problem 3: Vercel Build Fails — "Couldn't find any pages or app directory"

### Error
```
Error: > Couldn't find any `pages` or `app` directory. 
Please create one under the project root
```

### Why
Vercel couldn't find the Next.js app directory. This happens when:
1. The `rootDirectory` is not set correctly in Vercel project settings
2. The project structure has the app in a subdirectory (e.g., `instagram-automation/app/`)

### Solution

**Step 1** — Set the Root Directory in Vercel project settings:

```bash
# Via API (need Vercel token)
curl -s -X PATCH "https://api.vercel.com/v2/projects/PROJECT_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rootDirectory": "your-app-subdirectory"}'
```

Or via **Vercel Dashboard → Project → Settings → General → Root Directory**

**Step 2** — Commit and push to trigger redeploy.

### Verification
```bash
# Check current setting
vercel project inspect YOUR_PROJECT
# Look for "Root Directory" in output
```

---

## Problem 4: Vercel Build Fails — "ENOENT: no such file or directory, lstat '/vercel/path0/.next/...'"

### Error
```
ENOENT: no such file or directory, lstat '/vercel/path0/.next/routes-manifest-deterministic.json'
```

### Why
The `.next` build cache interferes with a fresh build. Common causes:
1. `--webpack` flag in the build script (conflicts with Vercel's Next.js defaults)
2. `outputFileTracingRoot` in `next.config.ts` pointing to wrong directory
3. Corrupted build cache from previous failed deployments

### Solution

**Fix 1** — Remove `--webpack` from build script:
```json
// package.json — before
"build": "next build --webpack"

// package.json — after  
"build": "next build"
```
In Next.js 16, webpack is default. The `--webpack` flag can conflict with Vercel's build environment.

**Fix 2** — Remove `outputFileTracingRoot` from next.config:
```typescript
// next.config.ts — before
import path from "node:path";
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname)
};

// next.config.ts — after
const nextConfig = {};
```

**Fix 3** — Trigger a fresh build without cache:
- In Vercel Dashboard → Deployment → **"Redeploy"** → uncheck "Use existing Build Cache"
- Or push a new commit

---

## Problem 5: Build Fails on Vercel but Works Locally

### Error
Vercel build fails but `npm run build` works perfectly on your machine.

### Why
Differences between local and Vercel environments:
1. Different Node.js versions
2. Missing SWC native binaries in lockfile
3. Different working directory
4. Environment variables

### Checklist

```bash
# 1. Match Node.js versions
node --version
# Vercel project uses 24.x

# 2. Check SWC dependencies
grep -c "@next/swc" package-lock.json
# Should be >0. If 0, run: npm install && npx next

# 3. Verify build locally
npm run build
# Should succeed without errors

# 4. Check all files are committed
git status
# Should show "nothing to commit, working tree clean"

# 5. Push any uncommitted changes
git add -A && git commit -m "fix: ..." && git push
```

---

## Problem 6: "Hobby teams do not support collaboration"

### Error (in Vercel Dashboard)
```
Hobby teams do not support collaboration. Please upgrade to Pro to add team members.
```

### Why
Vercel's free Hobby plan only allows one team member (the owner). The "Redeploy" button is disabled because:
- The deployment was created by a different method (CLI vs git)
- Or the team/account mismatch doesn't allow certain operations

### Solutions

**Option A** — Use Git-based deployment (automatic on push):
1. Push code to GitHub
2. Vercel auto-detects the push and deploys
3. No need to click Redeploy

**Option B** — Deploy via CLI:
```bash
cd your-app-directory
vercel --prod
```

**Option C** — Upgrade to Pro ($20/month) for team collaboration features.

---

## Problem 7: Cannot Redeploy from Vercel Dashboard

### Error
Redeploy button is greyed out or says "Blocked".

### Why
The deployment was created via `vercel deploy` CLI (not via git). The dashboard only allows redeploying git-based deployments.

### Solution
```bash
# From CLI
vercel --prod  # Redeploy latest code

# Or push to git to trigger auto-deploy
git commit --allow-empty -m "trigger deploy" && git push
```

---

## Quick Reference: Full Deploy Flow

```bash
# 1. Fix git config
git config user.email "your-vercel-github-email@example.com"

# 2. Set Vercel rootDirectory (if app is in subdirectory)
vercel project inspect YOUR_PROJECT  # Check current
# Set via: Vercel Dashboard → Settings → Root Directory

# 3. Clean up build config
# Remove --webpack from package.json build script
# Remove outputFileTracingRoot from next.config

# 4. Commit and push
git add -A
git commit -m "deploy: fixes"
git push origin main

# 5. Vercel auto-deploys (check dashboard)
# Alternative CLI deploy:
vercel --prod
```

## Environment Variables on Vercel

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Your Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Service role key |
| `ADMIN_PASSWORD` | `your-password` | App admin password |
| `META_GRAPH_BASE_URL` | `https://graph.instagram.com` | Meta API base |
| `META_GRAPH_VERSION` | `v24.0` | API version |
| `PUBLISH_WORKER_SECRET` | `your-secret` | Worker auth |

## Diagnosing Failed Deployments

```bash
# 1. List deployments
vercel list --environment production

# 2. Inspect a specific deployment
vercel inspect https://your-app.vercel.app

# 3. View runtime logs (for app errors, not build errors)
vercel logs https://your-app.vercel.app

# 4. Build logs (via dashboard only)
# Go to: Vercel Dashboard → Deployment → Logs tab
```

## Summary: The Three Identity Fix

```
GitHub Repo Owner (gurwinderwhara111)
  ├── Owns the repository
  ├── Has push access by default
  └── Vercel project connected via this account

Codespace User (thegurwinder134-stack)  
  ├── Must have push access (collaborator or PAT)
  ├── Git email must match Vercel account
  └── git config user.email = VERCEL_GITHUB_EMAIL

Vercel Account (gurwinderwhara777-1536)
  ├── Connected via GitHub OAuth
  ├── Must set rootDirectory if app is in subfolder
  └── Environment variables configured
```

**If these three are aligned, deployment works without issues.**
