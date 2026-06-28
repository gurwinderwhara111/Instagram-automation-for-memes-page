type MetaSuccess = {
  id: string;
};

type MetaStatus = {
  id: string;
  status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
};

async function readMetaResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Meta request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function graphUrl(path: string): string {
  const baseUrl = Deno.env.get("META_GRAPH_BASE_URL") || "https://graph.instagram.com";
  const version = Deno.env.get("META_GRAPH_VERSION") || "v21.0";
  return `${baseUrl.replace(/\/+$/, "")}/${version}/${path.replace(/^\/+/, "")}`;
}

export async function createReelContainer(input: {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<string> {
  const body = new URLSearchParams({
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    share_to_feed: "true",
    access_token: input.accessToken
  });

  const response = await fetch(graphUrl(`/${input.igUserId}/media`), {
    method: "POST",
    body
  });
  const data = await readMetaResponse<MetaSuccess>(response);
  return data.id;
}

export async function getContainerStatus(input: {
  creationId: string;
  accessToken: string;
}): Promise<MetaStatus["status_code"]> {
  const url = new URL(graphUrl(`/${input.creationId}`));
  url.searchParams.set("fields", "status_code");
  url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url);
  const data = await readMetaResponse<MetaStatus>(response);
  return data.status_code;
}

export async function publishReel(input: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<string> {
  const body = new URLSearchParams({
    creation_id: input.creationId,
    access_token: input.accessToken
  });

  const response = await fetch(graphUrl(`/${input.igUserId}/media_publish`), {
    method: "POST",
    body
  });
  const data = await readMetaResponse<MetaSuccess>(response);
  return data.id;
}
