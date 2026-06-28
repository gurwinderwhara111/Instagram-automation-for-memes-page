export type ReelStatus = "draft" | "scheduled" | "posting" | "posted" | "failed";

export type AccountStatus = "active" | "disabled";

export type InstagramAccount = {
  id: string;
  label: string;
  ig_user_id: string;
  access_token: string;
  token_expires_at: string | null;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
};

export type PublicInstagramAccount = Omit<InstagramAccount, "access_token"> & {
  has_access_token: boolean;
};

export type ScheduledReel = {
  id: string;
  account_id: string;
  title: string;
  video_path: string | null;
  video_url: string;
  caption: string;
  scheduled_at: string;
  status: ReelStatus;
  meta_creation_id: string | null;
  meta_publish_id: string | null;
  posted_at: string | null;
  error_message: string | null;
  attempts: number;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReelWithAccount = ScheduledReel & {
  instagram_accounts: Pick<InstagramAccount, "id" | "label" | "ig_user_id" | "status"> | null;
};

export type CreateReelInput = {
  accountId: string;
  title: string;
  videoPath?: string | null;
  videoUrl: string;
  caption: string;
  scheduledAt: string;
};

export type UpdateReelInput = Partial<CreateReelInput>;

export type BatchReelDraft = {
  draftId: string;
  title: string;
  videoPath: string;
  videoUrl: string;
  caption: string;
  scheduledAt: string;
  accountIds: string[];
};

export type CreateBatchReelsInput = {
  items: Array<Omit<BatchReelDraft, "draftId">>;
};

export type CreateAccountInput = {
  label: string;
  igUserId: string;
  accessToken: string;
  tokenExpiresAt?: string | null;
};

export type UpdateAccountInput = {
  label?: string;
  igUserId?: string;
  accessToken?: string;
  tokenExpiresAt?: string | null;
  status?: AccountStatus;
};

export type StorageUsage = {
  limitBytes: number;
  usedBytes: number;
  remainingBytes: number;
  usedPercent: number;
  limitLabel: string;
  usedLabel: string;
  remainingLabel: string;
};

export type BucketVideo = {
  name: string;
  path: string;
  publicUrl: string;
  size: number;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  usedByCount: number;
  pendingCount: number;
  fullyPosted: boolean;
  canDelete: boolean;
};

export type BucketSummary = {
  bucket: string;
  totalVideos: number;
  totalBytes: number;
  totalSizeLabel: string;
  usage: StorageUsage;
  videos: BucketVideo[];
};

export type UploadedImage = {
  bucket: string;
  path: string;
  publicUrl: string;
  size: number;
  mimeType: string;
};
