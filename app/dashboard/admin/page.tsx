"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  createLicenseKeyForApp,
  fetchUsersForAdmin,
  licenseApps,
  updateUserStatsAsAdmin,
  type AdminUserRecord,
  type AppLicense,
  type UserRole
} from "@/lib/firebase/firestore";

const editableRoles: UserRole[] = ["base", "licensed", "mod", "admin"];

export default function AdminPage() {
  const { loading, user, profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppLicense>("urbex-db");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(5);
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && !isAdmin) {
      router.replace("/dashboard");
      return;
    }

    if (!loading && user && isAdmin) {
      void fetchUsersForAdmin(user.uid).then(setUsers);
    }
  }, [isAdmin, loading, router, user]);

  const canRender = useMemo(() => !loading && Boolean(user) && isAdmin, [isAdmin, loading, user]);

  if (!canRender) {
    return (
      <main className="app-shell flex items-center justify-center text-sm text-[var(--text-muted)]">
        Loading admin panel...
      </main>
    );
  }

  async function refreshUsers() {
    if (!user) {
      return;
    }

    const nextUsers = await fetchUsersForAdmin(user.uid);
    setUsers(nextUsers);
  }

  async function onGenerateKey() {
    if (!user) {
      return;
    }

    setBusy(true);
    setPanelMessage(null);
    setGeneratedKey(null);

    const result = await createLicenseKeyForApp(user.uid, selectedApp);

    if (!result.ok) {
      setPanelMessage("Could not generate a key right now.");
      setBusy(false);
      return;
    }

    setGeneratedKey(result.code);
    setPanelMessage("Single-use key generated.");
    setBusy(false);
  }

  async function onGenerateBatch() {
    if (!user) {
      return;
    }

    setBusy(true);
    setPanelMessage(null);
    setGeneratedKeys([]);

    const keys: string[] = [];
    let failedCount = 0;

    for (let i = 0; i < batchCount; i++) {
      const result = await createLicenseKeyForApp(user.uid, selectedApp);
      if (result.ok) {
        keys.push(result.code);
      } else {
        failedCount++;
      }
    }

    if (keys.length === 0) {
      setPanelMessage(`Could not generate any keys. Tried ${batchCount} times.`);
      setBusy(false);
      return;
    }

    setGeneratedKeys(keys);
    setPanelMessage(
      failedCount > 0
        ? `Generated ${keys.length} of ${batchCount} keys. ${failedCount} failed.`
        : `Generated ${keys.length} keys successfully.`
    );
    setBusy(false);
  }

  async function onSaveStats(formData: FormData) {
    if (!user) {
      return;
    }

    const targetUid = String(formData.get("uid") ?? "");
    const score = Number(formData.get("score") ?? 0);
    const approvedSubmissions = Number(formData.get("approvedSubmissions") ?? 0);
    const role = String(formData.get("role") ?? "base") as UserRole;

    if (!targetUid) {
      return;
    }

    setBusy(true);
    setPanelMessage(null);

    const result = await updateUserStatsAsAdmin(user.uid, targetUid, {
      score,
      approvedSubmissions,
      role
    });

    if (!result.ok) {
      setPanelMessage("Could not update stats for that account.");
      setBusy(false);
      return;
    }

    setPanelMessage("Stats updated.");
    await refreshUsers();
    setBusy(false);
  }

  return (
    <main className="app-shell app-shell-compact">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="panel-strong rounded-[32px] px-6 py-8">
          <p className="eyebrow">Admin controls</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Users, stats, and license keys</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
            App keys are generated as HYDREX-########. Moderator role can be issued by key or assigned directly here.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="panel rounded-[32px] p-6">
            <p className="eyebrow">Generate app key</p>

            <label className="mt-5 block space-y-2 text-sm text-[var(--text-muted)]">
              <span>Target app</span>
              <select
                value={selectedApp}
                onChange={(event) => {
                  setSelectedApp(event.target.value as AppLicense);
                }}
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
              >
                {licenseApps.map((appOption) => (
                  <option key={appOption.id} value={appOption.id}>
                    {appOption.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white/80 px-4 py-3">
              <input
                type="checkbox"
                id="batchMode"
                checked={batchMode}
                onChange={(event) => {
                  setBatchMode(event.target.checked);
                  setGeneratedKey(null);
                  setGeneratedKeys([]);
                }}
                className="rounded border border-[var(--line)]"
              />
              <label htmlFor="batchMode" className="text-sm text-[var(--text)]">
                Batch generation mode
              </label>
            </div>

            {batchMode ? (
              <label className="mt-5 block space-y-2 text-sm text-[var(--text-muted)]">
                <span>Number of keys to generate</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={batchCount}
                  onChange={(event) => {
                    setBatchCount(Math.max(1, Math.min(100, Number(event.target.value))));
                  }}
                  className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-[var(--text)] outline-none"
                />
              </label>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (batchMode) {
                  void onGenerateBatch();
                } else {
                  void onGenerateKey();
                }
              }}
              className="mt-5 w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Working..." : batchMode ? `Generate ${batchCount} keys` : "Generate license key"}
            </button>

            {generatedKey ? (
              <div className="mt-5 rounded-2xl bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                <p className="font-semibold text-[var(--text)]">{generatedKey}</p>
                <p className="mt-2">Single-use key for {selectedApp === "urbex-db" ? "Urbex DB" : "moderator role"}.</p>
              </div>
            ) : null}

            {generatedKeys.length > 0 ? (
              <div className="mt-5 rounded-2xl bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="font-semibold text-[var(--text)]">{generatedKeys.length} keys generated</p>
                  <button
                    type="button"
                    onClick={() => {
                      const allKeys = generatedKeys.join("\n");
                      void navigator.clipboard.writeText(allKeys);
                      setPanelMessage("All keys copied to clipboard!");
                    }}
                    className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
                  >
                    Copy all
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {generatedKeys.map((key, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-[var(--line)]">
                      <code className="text-xs font-mono text-[var(--text)]">{key}</code>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(key);
                          setPanelMessage("Key copied!");
                        }}
                        className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {panelMessage ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">{panelMessage}</p>
            ) : null}
          </article>

          <article className="panel rounded-[32px] p-6">
            <p className="eyebrow">Account manager</p>
            <div className="mt-5 space-y-4">
              {users.length === 0 ? (
                <div className="rounded-2xl bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                  No user records found yet.
                </div>
              ) : null}

              {users.map((entry) => (
                <form
                  key={entry.uid}
                  action={(formData) => {
                    void onSaveStats(formData);
                  }}
                  className="rounded-2xl bg-white/80 p-4"
                >
                  <input type="hidden" name="uid" value={entry.uid} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[var(--text)]">{entry.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">{entry.email}</p>
                    </div>
                    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {entry.role}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-[var(--text-muted)]">
                      <span>Score</span>
                      <input
                        name="score"
                        type="number"
                        min={0}
                        defaultValue={entry.score}
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--text)] outline-none"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-muted)]">
                      <span>Approved submissions</span>
                      <input
                        name="approvedSubmissions"
                        type="number"
                        min={0}
                        defaultValue={entry.approvedSubmissions}
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--text)] outline-none"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[var(--text-muted)]">
                      <span>Role</span>
                      <select
                        name="role"
                        defaultValue={entry.role}
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-[var(--text)] outline-none"
                      >
                        {editableRoles.map((roleOption) => (
                          <option key={roleOption} value={roleOption}>
                            {roleOption}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Access: {Object.entries(entry.appAccess).filter(([, value]) => value).map(([name]) => name).join(", ") || "none"}
                    </p>
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save stats
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </article>
        </section>

        <Link href="/dashboard" className="inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
