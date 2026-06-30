"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RotateCcw,
  Scissors,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export interface ResetUser {
  userId: string;
  userName: string;
  itemCount: number;
  ignoredCount: number;
}

interface DashboardResetUsersProps {
  datasetId: string;
  users: ResetUser[];
  responsibleColumn: string | null;
  responsibleNames: string[];
}

export function DashboardResetUsers({
  datasetId,
  users,
  responsibleColumn,
  responsibleNames,
}: DashboardResetUsersProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [resettingId, setResettingId] = React.useState<string | null>(null);
  const [trimmingId, setTrimmingId] = React.useState<string | null>(null);
  const [keepByUser, setKeepByUser] = React.useState<Record<string, string>>({});

  if (users.length === 0) return null;

  const canTrim = !!responsibleColumn && responsibleNames.length > 0;

  const handleReset = async (user: ResetUser) => {
    setResettingId(user.userId);
    try {
      const res = await fetch(
        `/api/orders?datasetId=${datasetId}&userId=${encodeURIComponent(
          user.userId
        )}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not reset.");
      toast.success(`Reset ${user.userName}'s submission.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset.");
    } finally {
      setResettingId(null);
      setConfirmId(null);
    }
  };

  const handleTrim = async (user: ResetUser) => {
    const keep = keepByUser[user.userId];
    if (!keep) {
      toast.error(`Pick which ${responsibleColumn} to keep for ${user.userName}.`);
      return;
    }
    setTrimmingId(user.userId);
    try {
      const res = await fetch(`/api/orders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          userId: user.userId,
          responsibleColumn,
          keep,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not trim.");
      toast.success(
        `Trimmed ${user.userName} to ${keep} — removed ${
          (data.removedItems ?? 0) + (data.removedIgnored ?? 0)
        } row(s).`
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not trim.");
    } finally {
      setTrimmingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-sm font-semibold transition-colors hover:text-primary"
      >
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <RotateCcw className="size-4 text-muted-foreground" />
        <span>Fix a user&apos;s submission</span>
        <span className="text-xs font-normal text-muted-foreground">
          ({users.length})
        </span>
      </button>
      {open && (
      <div className="mt-3 flex flex-col gap-2">
        {users.map((user) => {
          const resetting = resettingId === user.userId;
          const trimming = trimmingId === user.userId;
          const confirming = confirmId === user.userId;
          const busy = resetting || trimming;

          return (
            <div
              key={user.userId}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <div className="mr-auto flex items-baseline gap-2">
                <span className="text-sm font-medium">{user.userName}</span>
                <span className="text-xs text-muted-foreground">
                  {user.itemCount} ordered
                  {user.ignoredCount > 0 && ` · ${user.ignoredCount} ignored`}
                </span>
              </div>

              {canTrim && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Keep {responsibleColumn}:
                  </span>
                  <select
                    value={keepByUser[user.userId] ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      setKeepByUser((m) => ({
                        ...m,
                        [user.userId]: e.target.value,
                      }))
                    }
                    className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="">—</option>
                    {responsibleNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5"
                    disabled={busy || !keepByUser[user.userId]}
                    onClick={() => handleTrim(user)}
                  >
                    {trimming ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <Scissors className="size-3.5" /> Trim
                      </>
                    )}
                  </Button>
                </div>
              )}

              {confirming ? (
                <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5">
                  <span className="text-xs font-medium text-destructive">
                    Reset all?
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 px-3"
                    disabled={busy}
                    onClick={() => handleReset(user)}
                  >
                    {resetting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      "Yes"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3"
                    disabled={busy}
                    onClick={() => setConfirmId(null)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  disabled={busy}
                  onClick={() => setConfirmId(user.userId)}
                >
                  <RotateCcw className="size-3.5" /> Reset
                </Button>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
