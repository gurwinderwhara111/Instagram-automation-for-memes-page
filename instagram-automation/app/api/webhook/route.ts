import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.META_VERIFY_TOKEN || "inkboost_verify_2024";

  if (mode === "subscribe" && token === expectedToken && challenge) {
    console.log("[webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[webhook] Verification failed", { mode, token });
  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[webhook] Event received:", JSON.stringify(body).slice(0, 500));

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const field = changes?.field;

    if (field === "comments") {
      console.log("[webhook] Comment event:", JSON.stringify(changes.value));
    } else if (field === "media" || field === "live_comments") {
      console.log("[webhook] Media event:", JSON.stringify(changes.value));
    } else if (field === "messages") {
      console.log("[webhook] Message event:", JSON.stringify(changes.value));
    }

    return NextResponse.json({ status: "EVENT_RECEIVED" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing error";
    console.error("[webhook] Error processing event:", message);
    return NextResponse.json({ status: "EVENT_RECEIVED" });
  }
}
