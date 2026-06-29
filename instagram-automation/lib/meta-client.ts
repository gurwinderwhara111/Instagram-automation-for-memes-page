const META_FETCH_TIMEOUT = 25_000;

type MetaSuccess = {
  id: string;
};

type MetaStatus = {
  id: string;
  status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
};

export type MetaAccountProfile = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
  media_count?: number;
};

function metaFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_FETCH_TIMEOUT);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function readMetaResponse<T>(response: Response): Promise<T> {
  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown> | null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorObj = (payload?.error as Record<string, unknown>) || payload;
    const code = errorObj?.code ? ` (code: ${errorObj.code})` : "";
    const subcode = errorObj?.error_subcode ? ` subcode: ${errorObj.error_subcode}` : "";
    const message =
      errorObj?.message ||
      payload?.message ||
      `Meta request failed with ${response.status}`;
    const fullMessage = `${message}${code}${subcode}`;
    console.error(`[Meta API Error] ${response.status}: ${fullMessage}`, JSON.stringify(payload));
    throw new Error(fullMessage);
  }

  if (payload === null) {
    throw new Error("Meta returned an empty response (no JSON body).");
  }

  return payload as T;
}

function graphUrl(path: string): string {
  const baseUrl = process.env.META_GRAPH_BASE_URL || "https://graph.instagram.com";
  const version = process.env.META_GRAPH_VERSION || "v24.0";
  return `${baseUrl.replace(/\/+$/, "")}/${version}/${path.replace(/^\/+/, "")}`;
}

export async function testInstagramAccount(input: {
  igUserId: string;
  accessToken: string;
}): Promise<MetaAccountProfile> {
  const directUrl = new URL(graphUrl(`/${input.igUserId}`));
  directUrl.searchParams.set("fields", "id,username,account_type,media_count");
  directUrl.searchParams.set("access_token", input.accessToken);

  const directResponse = await metaFetch(directUrl.toString());
  if (directResponse.ok) {
    return readMetaResponse<MetaAccountProfile>(directResponse);
  }

  const meUrl = new URL(graphUrl("/me"));
  meUrl.searchParams.set("fields", "user_id,username,account_type,media_count");
  meUrl.searchParams.set("access_token", input.accessToken);

  const meProfile = await readMetaResponse<MetaAccountProfile>(await metaFetch(meUrl.toString()));
  const returnedUserId = meProfile.user_id || meProfile.id;
  if (returnedUserId && returnedUserId !== input.igUserId) {
    throw new Error(
      `Token belongs to Instagram user ${returnedUserId}, not configured account ${input.igUserId}.`
    );
  }

  return {
    ...meProfile,
    id: returnedUserId || meProfile.id
  };
}

export async function createImageContainer(input: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const body = new URLSearchParams({
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: input.accessToken
  });

  const response = await metaFetch(graphUrl(`/${input.igUserId}/media`), {
    method: "POST",
    body
  });
  const data = await readMetaResponse<MetaSuccess>(response);
  return data.id;
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

  const response = await metaFetch(graphUrl(`/${input.igUserId}/media`), {
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

  const response = await metaFetch(url.toString());
  const data = await readMetaResponse<MetaStatus>(response);
  return data.status_code;
}

export async function getContainerStatusWithMeta(input: {
  creationId: string;
  accessToken: string;
}): Promise<MetaStatus> {
  const url = new URL(graphUrl(`/${input.creationId}`));
  url.searchParams.set("fields", "status_code");
  url.searchParams.set("access_token", input.accessToken);

  const response = await metaFetch(url.toString());
  return readMetaResponse<MetaStatus>(response);
}

export async function publishMedia(input: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<string> {
  const body = new URLSearchParams({
    creation_id: input.creationId,
    access_token: input.accessToken
  });

  const response = await metaFetch(graphUrl(`/${input.igUserId}/media_publish`), {
    method: "POST",
    body
  });
  const data = await readMetaResponse<MetaSuccess>(response);
  return data.id;
}
