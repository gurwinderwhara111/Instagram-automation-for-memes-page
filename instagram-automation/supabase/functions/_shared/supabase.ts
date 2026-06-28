import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type ScheduledReel = {
  id: string;
  account_id: string;
  title: string;
  video_path: string | null;
  video_url: string;
  caption: string;
  scheduled_at: string;
  status: "draft" | "scheduled" | "posting" | "posted" | "failed";
  meta_creation_id: string | null;
  meta_publish_id: string | null;
  posted_at: string | null;
  error_message: string | null;
  attempts: number;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InstagramAccount = {
  id: string;
  label: string;
  ig_user_id: string;
  access_token: string;
  token_expires_at: string | null;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createServiceClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false
    }
  });
}
