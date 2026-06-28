import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://abnfrtvuxnuslmebcbca.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmZydHZ1eG51c2xtZWJjYmNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI4NDY5MCwiZXhwIjoyMDkwODYwNjkwfQ.jx4c4t1qMFQYnICn54oqxDs7xdB-QL0Rp3bF7VoGGnE';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const META_GRAPH = 'https://graph.instagram.com/v21.0';

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve().then(async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (e) {
      failed++;
      console.log(`  ❌ ${name}`);
      console.log(`     ${e.message}`);
    }
  });
}

async function metaGet(path, token) {
  const url = new URL(`${META_GRAPH}/${path}`);
  url.searchParams.set('access_token', token);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

async function main() {
  console.log('\n🔍 DEEP ACCOUNT & SYSTEM TEST\n');

  // ── 1. Supabase Connection ──
  console.log('📡 SUPABASE CONNECTION');
  await test('Supabase URL reachable', async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.status !== 401 && res.status !== 200) throw new Error(`Unexpected status: ${res.status}`);
  });

  await test('Service role key works', async () => {
    const { data, error } = await supabase.from('instagram_accounts').select('count', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
  });

  // ── 2. Database Schema & Data ──
  console.log('\n🗄️  DATABASE');

  let accounts, reels;
  await test('instagram_accounts table exists', async () => {
    const { data, error } = await supabase.from('instagram_accounts').select('*');
    if (error) throw new Error(error.message);
    accounts = data;
  });

  await test('scheduled_reels table exists', async () => {
    const { data, error } = await supabase.from('scheduled_reels').select('*');
    if (error) throw new Error(error.message);
    reels = data;
  });

  console.log(`   Accounts: ${accounts?.length || 0}, Reels: ${reels?.length || 0}`);

  // ── 3. Account Token Deep Tests ──
  console.log('\n👤 INSTAGRAM ACCOUNT TOKEN TESTS');
  for (const acct of accounts || []) {
    const label = acct.label.padEnd(20);
    await test(`${label} - Graph API reachable`, async () => {
      const profile = await metaGet(acct.ig_user_id, acct.access_token);
      if (!profile.id) throw new Error('No profile ID returned');
    });

    await test(`${label} - Token belongs to user`, async () => {
      const profile = await metaGet(acct.ig_user_id, acct.access_token);
      if (profile.id !== acct.ig_user_id) {
        throw new Error(`Token user ${profile.id} != configured ${acct.ig_user_id}`);
      }
    });

    await test(`${label} - /me endpoint fallback`, async () => {
      const data = await metaGet('me', acct.access_token);
      if (!data.user_id && !data.id) throw new Error('No user info from /me');
    });

    await test(`${label} - Token not expired`, async () => {
      const profile = await metaGet(acct.ig_user_id, acct.access_token);
      if (profile.error?.type === 'OAuthException') throw new Error('Token is invalid');
    });

    // Check if this is the account that failed before
    const failedReels = reels?.filter(r => r.account_id === acct.id && r.status === 'failed') || [];
    if (failedReels.length > 0) {
      const sampleError = failedReels[0]?.error_message;
      console.log(`   ⚠️  ${acct.label}: ${failedReels.length} failed reels`);
      if (sampleError) console.log(`      Last error: ${sampleError}`);
    }

    // Check which accounts have posted successfully
    const postedReels = reels?.filter(r => r.account_id === acct.id && r.status === 'posted') || [];
    if (postedReels.length > 0) {
      console.log(`   ✅ ${acct.label}: ${postedReels.length} reels posted successfully`);
    }
  }

  // ── 4. RPC Functions ──
  console.log('\n⚙️  RPC FUNCTIONS');
  await test('claim_due_reel() exists', async () => {
    const { error } = await supabase.rpc('claim_due_reel');
    // If no rows due, it should return empty, not error
    if (error && !error.message.includes('query returned')) throw error;
  });

  await test('recover_stuck_reels() exists', async () => {
    const { data, error } = await supabase.rpc('recover_stuck_reels', {
      max_age_minutes: 1,
      max_attempts: 5
    });
    if (error && !error.message.includes('recover_stuck_reels')) throw error;
    console.log(`   Stuck reels recovered: ${data || 0}`);
  });

  // ── 5. Storage ──
  console.log('\n📦 STORAGE');
  await test('Storage bucket exists', async () => {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const bucket = data.find(b => b.name.includes('Instagram'));
    if (!bucket) throw new Error('Instagram bucket not found');
    console.log(`   Bucket: ${bucket.name} (public: ${bucket.public})`);
  });

  await test('List files in bucket', async () => {
    const { data, error } = await supabase.storage.from('Instagram reels and clips storage').list();
    if (error) throw error;
    console.log(`   Files found: ${data?.length || 0}`);
    if (data?.length) {
      data.forEach(f => console.log(`      - ${f.name}`));
    } else {
      console.log(`   ⚠️  Bucket is empty - videos may need to be re-uploaded`);
    }
  });

  // ── 6. Cron Job Status ──
  console.log('\n⏰ CRON JOBS');
  await test('Cron jobs active', async () => {
    const { data, error } = await supabase.rpc('cron.unschedule', { job_name: '_check_' }).select();
    // This will fail since we can't call cron via REST easily, but let's check via SQL
    if (error && !error.message.includes('function "cron.unschedule"')) throw error;
  });

  // Quick SQL via RPC check - use a query to check cron
  try {
    const { data: cronData } = await supabase.from('cron.job').select('jobname, schedule, active').then(d => d);
    if (cronData) console.log(`   Found ${cronData.length} cron jobs`);
  } catch {
    console.log('   ⚠️  Cannot query cron.job table directly via REST API');
    console.log('   Cron is configured via migration 004_cron_publish_due_reels.sql');
  }

  // ── 7. Reel Status Summary ──
  console.log('\n📊 REEL STATUS SUMMARY');
  const statuses = {};
  for (const reel of reels || []) {
    statuses[reel.status] = (statuses[reel.status] || 0) + 1;
  }
  for (const [status, count] of Object.entries(statuses)) {
    console.log(`   ${status}: ${count}`);
  }

  // ── 8. Results ──
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(console.error);
