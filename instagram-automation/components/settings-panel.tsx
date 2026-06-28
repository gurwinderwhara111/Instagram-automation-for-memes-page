"use client";

import { useEffect, useMemo, useState } from "react";
import {
  notUsedInV1,
  primaryPublishingAccount,
  primaryPublishingApp,
  requiredMetaInputs,
  secondaryPublishingAccounts
} from "@/lib/meta-defaults";
import type { AccountStatus, PublicInstagramAccount } from "@/lib/types";

type AccountForm = {
  label: string;
  igUserId: string;
  accessToken: string;
  tokenExpiresAt: string;
};

type AccountTest = {
  connected: boolean;
  profile?: {
    username?: string;
    account_type?: string;
    media_count?: number;
  };
  error?: string;
};

async function readPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    details?: { message?: string }[];
  };
  if (!response.ok) {
    throw new Error(payload.details?.[0]?.message || payload.error || "Request failed");
  }
  return payload;
}

function emptyForm(): AccountForm {
  return {
    label: primaryPublishingAccount.label,
    igUserId: primaryPublishingAccount.igUserId,
    accessToken: "",
    tokenExpiresAt: ""
  };
}

export function SettingsPanel() {
  const [adminPassword, setAdminPassword] = useState("");
  const [accounts, setAccounts] = useState<PublicInstagramAccount[]>([]);
  const [message, setMessage] = useState("Load accounts after setting your admin password.");
  const [form, setForm] = useState<AccountForm>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, AccountTest>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(adminPassword ? { "x-admin-password": adminPassword } : {})
    }),
    [adminPassword]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAdminPassword(window.sessionStorage.getItem("instagram-admin-password") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadAccounts = async () => {
    window.sessionStorage.setItem("instagram-admin-password", adminPassword);
    setMessage("Loading accounts...");
    try {
      const payload = await fetch("/api/accounts", { headers, cache: "no-store" }).then(
        (response) => readPayload<{ accounts: PublicInstagramAccount[] }>(response)
      );
      setAccounts(payload.accounts);
      setMessage("Accounts loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load accounts.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const saveAccount = async () => {
    setIsSaving(true);
    setMessage(editingId ? "Updating account..." : "Saving account...");
    try {
      const payload = {
        label: form.label,
        igUserId: form.igUserId,
        ...(form.accessToken ? { accessToken: form.accessToken } : {}),
        tokenExpiresAt: form.tokenExpiresAt ? new Date(form.tokenExpiresAt).toISOString() : null
      };
      const response = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(payload)
      });
      await readPayload(response);
      resetForm();
      setMessage(editingId ? "Account updated." : "Account saved.");
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save account.");
    } finally {
      setIsSaving(false);
    }
  };

  const editAccount = (account: PublicInstagramAccount) => {
    setEditingId(account.id);
    setForm({
      label: account.label,
      igUserId: account.ig_user_id,
      accessToken: "",
      tokenExpiresAt: account.token_expires_at ? account.token_expires_at.slice(0, 16) : ""
    });
    setMessage(`Editing ${account.label}. Leave token blank to keep the saved token.`);
  };

  const setAccountStatus = async (account: PublicInstagramAccount, status: AccountStatus) => {
    setMessage(`${status === "active" ? "Enabling" : "Disabling"} ${account.label}...`);
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status })
      });
      await readPayload(response);
      setMessage(`${account.label} is now ${status}.`);
      await loadAccounts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update account status.");
    }
  };

  const testAccount = async (account: PublicInstagramAccount) => {
    setTestingId(account.id);
    setMessage(`Testing ${account.label}...`);
    try {
      const payload = await fetch(`/api/accounts/${account.id}/test`, {
        method: "POST",
        headers
      }).then((response) => readPayload<AccountTest>(response));
      setTests((current) => ({ ...current, [account.id]: payload }));
      setMessage(`${account.label} connected.`);
    } catch (error) {
      const failed = {
        connected: false,
        error: error instanceof Error ? error.message : "Failed to test account."
      };
      setTests((current) => ({ ...current, [account.id]: failed }));
      setMessage(failed.error);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <section className="rounded border border-line bg-white p-4">
        <h2 className="text-xl font-semibold text-ink">
          {editingId ? "Edit publishing account" : "Add publishing account"}
        </h2>
        <p className="mt-1 text-sm text-steel">
          Manual-token v1 for <span className="font-semibold text-ink">{primaryPublishingApp.name}</span>.
          Tokens stay server-side.
        </p>

        <label className="mt-4 grid gap-2 text-sm font-medium text-ink">
          Admin password
          <input
            type="password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
          />
        </label>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Account label
            <input
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder={`Label, e.g. ${primaryPublishingAccount.label}`}
              className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Instagram user ID
            <input
              value={form.igUserId}
              onChange={(event) => setForm({ ...form, igUserId: event.target.value })}
              placeholder={`Instagram user ID, e.g. ${primaryPublishingAccount.igUserId}`}
              className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Access token
            <textarea
              value={form.accessToken}
              onChange={(event) => setForm({ ...form, accessToken: event.target.value })}
              placeholder={
                editingId
                  ? "Leave blank to keep the saved token"
                  : "Instagram business access token"
              }
              rows={5}
              className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Token expiry
            <input
              type="datetime-local"
              value={form.tokenExpiresAt}
              onChange={(event) => setForm({ ...form, tokenExpiresAt: event.target.value })}
              className="rounded border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveAccount}
            disabled={isSaving}
            className="rounded bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-ink disabled:bg-steel/50"
          >
            {isSaving ? "Saving..." : editingId ? "Save changes" : "Save account"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-coral hover:text-coral"
            >
              Cancel edit
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              setForm((current) => ({
                ...current,
                label: primaryPublishingAccount.label,
                igUserId: primaryPublishingAccount.igUserId
              }))
            }
            className="rounded border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-moss hover:text-moss"
          >
            Use ink_boost defaults
          </button>
          <button
            type="button"
            onClick={loadAccounts}
            className="rounded border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-moss hover:text-moss"
          >
            Load accounts
          </button>
        </div>
        <p className="mt-3 text-sm text-steel">{message}</p>
      </section>

      <section className="rounded border border-line bg-white p-4">
        <h2 className="text-xl font-semibold text-ink">Configured accounts</h2>
        <div className="mt-4 grid gap-3">
          {accounts.map((account) => {
            const result = tests[account.id];
            return (
              <div key={account.id} className="rounded border border-line bg-panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{account.label}</p>
                  <span
                    className={`rounded border px-2 py-1 text-xs font-semibold ${
                      account.status === "active"
                        ? "border-moss/30 bg-moss/10 text-moss"
                        : "border-coral/30 bg-coral/10 text-coral"
                    }`}
                  >
                    {account.status}
                  </span>
                  {account.label === primaryPublishingAccount.label &&
                  account.ig_user_id === primaryPublishingAccount.igUserId ? (
                    <span className="rounded border border-moss/30 bg-moss/10 px-2 py-1 text-xs font-semibold text-moss">
                      Primary v1 account
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-steel">IG user ID: {account.ig_user_id}</p>
                <p className="mt-1 text-sm text-steel">
                  Token saved: {account.has_access_token ? "yes" : "no"}
                </p>
                <p className="mt-1 text-sm text-steel">
                  Expires: {account.token_expires_at || "not set"}
                </p>
                {result ? (
                  <p className={`mt-2 text-sm ${result.connected ? "text-moss" : "text-coral"}`}>
                    {result.connected
                      ? `Connected @${result.profile?.username || "unknown"} · ${
                          result.profile?.media_count ?? 0
                        } media`
                      : result.error}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => editAccount(account)}
                    className="rounded border border-line px-3 py-2 text-xs font-semibold text-ink hover:border-moss hover:text-moss"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAccountStatus(
                        account,
                        account.status === "active" ? "disabled" : "active"
                      )
                    }
                    className="rounded border border-line px-3 py-2 text-xs font-semibold text-ink hover:border-coral hover:text-coral"
                  >
                    {account.status === "active" ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => testAccount(account)}
                    disabled={testingId === account.id || account.status !== "active"}
                    className="rounded border border-line px-3 py-2 text-xs font-semibold text-moss hover:border-moss disabled:text-steel"
                  >
                    {testingId === account.id ? "Testing..." : "Test connection"}
                  </button>
                </div>
              </div>
            );
          })}
          {!accounts.length ? <p className="text-sm text-steel">No accounts loaded.</p> : null}
        </div>

        <div className="mt-6 rounded border border-line bg-panel p-3 text-sm leading-6 text-steel">
          <p className="font-semibold text-ink">V1 publishing defaults</p>
          <p>
            App: {primaryPublishingApp.name} ({primaryPublishingApp.appId})
          </p>
          <p>
            First live account: {primaryPublishingAccount.label} (
            {primaryPublishingAccount.igUserId})
          </p>
          <p className="mt-3 font-semibold text-ink">Meta values to collect</p>
          {requiredMetaInputs.map((item) => (
            <p key={item}>{item}</p>
          ))}
          <p className="mt-3 font-semibold text-ink">Secondary accounts for later</p>
          {secondaryPublishingAccounts.map((account) => (
            <p key={account.igUserId}>
              {account.label} ({account.igUserId})
            </p>
          ))}
          <p className="mt-3 font-semibold text-ink">Not used in v1</p>
          {notUsedInV1.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
