import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  return url;
}

export function createSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

export function isAdminRequest(request: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return true;
  }
  return request.headers.get("x-admin-password") === expected;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Admin password is required." }, { status: 401 });
}
