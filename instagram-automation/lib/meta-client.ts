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

  const directResponse = await fetch(directUrl);
  if (directResponse.ok) {
    return readMetaResponse<MetaAccountProfile>(directResponse);
  }

  const meUrl = new URL(graphUrl("/me"));
  meUrl.searchParams.set("fields", "user_id,username,account_type,media_count");
  meUrl.searchParams.set("access_token", input.accessToken);

  const meProfile = await readMetaResponse<MetaAccountProfile>(await fetch(meUrl));
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

  const response = await fetch(graphUrl(`/${input.igUserId}/media`), {
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

export async function publishMedia(input: {
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
