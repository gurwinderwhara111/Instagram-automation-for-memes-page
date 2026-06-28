export const primaryPublishingApp = {
  name: "inkboost-IG",
  appId: "873157062297648"
};

export const primaryPublishingAccount = {
  label: "ink_boost",
  igUserId: "17841467513135062"
};

export const secondaryPublishingAccounts = [
  {
    label: "edits_pro_studio",
    igUserId: "17841468727066204"
  },
  {
    label: "cliendly.in",
    igUserId: "17841472395466975"
  }
];

export const requiredMetaInputs = [
  "Meta app name",
  "Meta app ID",
  "Instagram user ID",
  "Instagram business access token",
  "Optional token expiry"
] as const;

export const notUsedInV1 = [
  "Facebook app 890895456820829",
  "Webhook subscriptions",
  "Instagram messaging permissions",
  "Comment moderation flows",
  "OAuth callback handling",
  "JavaScript SDK login",
  "Deauthorize and data deletion callback flows",
  "Automated app review setup"
] as const;
