"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRequestStatus, type RequestStatus } from "@/lib/request-status";

export interface MyRequestItem {
  name: string;
  quantity: number;
  approvedQty: number | null;
  completed: boolean;
}

interface MyRequestsViewProps {
  items: MyRequestItem[];
  updatedAt: string | null;
}

type FilterKey = "all" | RequestStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "reduced", label: "Partial" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_STYLES: Record<
  RequestStatus,
  { badge: string; icon: React.ReactNode }
> = {
  completed: {
    badge:
      "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    icon: <CheckCircle2 className="size-3.5" />,
  },
  approved: {
    badge:
      "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    icon: <CheckCircle2 className="size-3.5" />,
  },
  reduced: {
    badge:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: <MinusCircle className="size-3.5" />,
  },
  rejected: {
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    icon: <XCircle className="size-3.5" />,
  },
  pending: {
    badge: "bg-muted text-muted-foreground border-border",
    icon: <Clock className="size-3.5" />,
  },
};

export function MyRequestsView({ items, updatedAt }: MyRequestsViewProps) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [search, setSearch] = React.useState("");
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const removeItem = async (name: string) => {
    setDeleting(name);
    try {
      const res = await fetch(`/api/requests?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not remove.");
      toast.success(`Removed "${name}".`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    } finally {
      setDeleting(null);
    }
  };

  const enriched = React.useMemo(
    () => items.map((it) => ({ ...it, info: getRequestStatus(it) })),
    [items],
  );

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: enriched.length };
    for (const it of enriched) c[it.info.status] = (c[it.info.status] ?? 0) + 1;
    return c;
  }, [enriched]);

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((it) => {
      if (filter !== "all" && it.info.status !== filter) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, filter, search]);

  const totalRequested = enriched.reduce((n, it) => n + it.quantity, 0);
  const totalApproved = enriched.reduce(
    (n, it) => n + (it.approvedQty ?? 0),
    0,
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border p-10 text-center text-muted-foreground">
        You haven&apos;t submitted any custom requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Items</p>
          <p className="text-xl font-semibold tabular-nums">
            {enriched.length.toLocaleString("en-US")}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Total requested</p>
          <p className="text-xl font-semibold tabular-nums">
            {totalRequested.toLocaleString("en-US")}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Total approved</p>
          <p className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
            {totalApproved.toLocaleString("en-US")}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Last updated</p>
          <p className="text-sm font-medium">
            {updatedAt
              ? new Date(updatedAt).toLocaleDateString("en-US")
              : "—"}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item name…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {counts[f.key] ? (
                <span className="ml-1 opacity-70">({counts[f.key]})</span>
              ) : null}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-card">
            <tr>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Item
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Requested
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Approved
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Status
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold" />
            </tr>
          </thead>
          <tbody>
            {visible.map((it, i) => {
              const style = STATUS_STYLES[it.info.status];
              const isResolved =
                it.info.status === "completed" || it.info.status === "rejected";
              return (
                <tr
                  key={`${it.name}-${i}`}
                  className={cn(
                    "border-b border-border last:border-0 hover:bg-muted/40",
                    it.info.status === "completed" && "bg-green-500/5",
                    it.info.status === "rejected" && "bg-destructive/5",
                  )}
                >
                  <td
                    className={cn(
                      "px-3 py-2 text-center",
                      isResolved && it.info.status === "rejected" && "line-through opacity-60",
                    )}
                  >
                    {it.name}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {it.quantity.toLocaleString("en-US")}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-center tabular-nums font-medium",
                      it.info.status === "reduced" &&
                        "text-amber-600 dark:text-amber-400",
                      it.info.status === "pending" && "text-muted-foreground",
                    )}
                  >
                    {it.approvedQty !== null
                      ? it.approvedQty.toLocaleString("en-US")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                        style.badge,
                      )}
                    >
                      {style.icon}
                      {it.info.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {it.info.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        disabled={deleting === it.name}
                        onClick={() => removeItem(it.name)}
                        title="Remove this pending item"
                      >
                        {deleting === it.name ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No items match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
