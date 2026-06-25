"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Download, Loader2, Package, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminItem {
  name: string;
  quantity: number;
  approvedQty: number | null;
  completed: boolean;
  unavailable: boolean;
}

interface UserRequest {
  userId: string;
  userName: string;
  items: AdminItem[];
  updatedAt: string;
}

interface CustomRequestsAdminProps {
  requests: UserRequest[];
}

export function CustomRequestsAdmin({ requests }: CustomRequestsAdminProps) {
  const router = useRouter();
  const [data, setData] = React.useState(requests);
  const [saving, setSaving] = React.useState(false);
  const [hideCompleted, setHideCompleted] = React.useState(true);
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  // Keep local state in sync when the server re-renders fresh data.
  React.useEffect(() => {
    setData(requests);
    setDirty(new Set());
  }, [requests]);

  const patchItem = (
    userId: string,
    itemName: string,
    patch: Partial<AdminItem>,
  ) => {
    setData((prev) =>
      prev.map((req) =>
        req.userId === userId
          ? {
              ...req,
              items: req.items.map((it) =>
                it.name === itemName ? { ...it, ...patch } : it,
              ),
            }
          : req,
      ),
    );
    setDirty((prev) => new Set(prev).add(userId));
  };

  const saveAll = async () => {
    const toSave = data.filter((r) => dirty.has(r.userId));
    if (toSave.length === 0) return;
    setSaving(true);
    try {
      for (const req of toSave) {
        const res = await fetch("/api/requests/admin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: req.userId,
            items: req.items.map((it) => ({
              name: it.name,
              approvedQty: it.approvedQty,
              completed: it.completed,
              unavailable: it.unavailable,
            })),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `Could not save ${req.userName}.`);
      }
      toast.success(
        `Saved ${toSave.length} request${toSave.length === 1 ? "" : "s"}.`,
      );
      setDirty(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const totalItems = data.reduce((n, r) => n + r.items.length, 0);
  const completedCount = data.reduce(
    (n, r) => n + r.items.filter((it) => it.completed).length,
    0,
  );

  const hasFilters = search.trim() !== "" || from !== "" || to !== "";
  const clearFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
  };

  // Flatten every user's items into a single list, applying search + date filters.
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromT = from ? new Date(from).setHours(0, 0, 0, 0) : null;
    const toT = to ? new Date(to).setHours(23, 59, 59, 999) : null;

    return data.flatMap((req) => {
      const t = new Date(req.updatedAt).getTime();
      if (fromT !== null && t < fromT) return [];
      if (toT !== null && t > toT) return [];

      return req.items
        .filter((it) => !hideCompleted || !it.completed)
        .filter(
          (it) =>
            !q ||
            it.name.toLowerCase().includes(q) ||
            req.userName.toLowerCase().includes(q),
        )
        .map((it) => ({
          userId: req.userId,
          userName: req.userName,
          item: it,
        }));
    });
  }, [data, hideCompleted, search, from, to]);

  // Excel export: only non-completed items, only the item name + requested qty.
  const exportToExcel = () => {
    const rows = filtered
      .filter((r) => !r.item.completed)
      .map((r) => ({
        Item: r.item.name,
        Requested: r.item.quantity,
      }));

    if (rows.length === 0) {
      toast.error("No items to export.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["Item", "Requested"],
    });
    XLSX.utils.book_append_sheet(wb, ws, "Custom requests");
    XLSX.writeFile(wb, "custom_requests.xlsx");
  };

  if (data.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Custom requests
            </h2>
            <p className="text-sm text-muted-foreground">
              {data.length} user{data.length === 1 ? "" : "s"} &middot;{" "}
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="size-4 accent-green-600 align-middle"
            />
            Hide completed
            {completedCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({completedCount})
              </span>
            )}
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={totalItems === 0}
          >
            <Download className="size-3.5" /> Export Excel
          </Button>

          <Button size="sm" onClick={saveAll} disabled={saving || dirty.size === 0}>
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            {saving
              ? "Saving..."
              : dirty.size > 0
                ? `Save (${dirty.size})`
                : "Save"}
          </Button>
        </div>
      </div>

      {/* Filters: free-text search + date range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item or user…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>From</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-card">
            <tr>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                User
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Item
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Requested
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Approved qty
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Completed
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                تعذر
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ userId, userName, item }) => (
              <tr
                key={`${userId}-${item.name}`}
                className={cn(
                  "border-b border-border last:border-0 hover:bg-muted/40",
                  item.completed && "bg-green-500/5",
                  item.unavailable && "bg-destructive/5",
                )}
              >
                <td className="px-3 py-2 text-center font-medium">
                  {userName}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-center",
                    (item.completed || item.unavailable) &&
                      "line-through opacity-60",
                  )}
                >
                  {item.name}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {item.quantity.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={0}
                    value={item.approvedQty ?? ""}
                    placeholder={String(item.quantity)}
                    disabled={item.unavailable}
                    onChange={(e) =>
                      patchItem(userId, item.name, {
                        approvedQty:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className={cn(
                      "h-8 w-24 rounded-md border border-border bg-background px-2 text-center text-sm tabular-nums outline-none",
                      "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={(e) =>
                      patchItem(userId, item.name, {
                        completed: e.target.checked,
                        ...(e.target.checked ? { unavailable: false } : {}),
                      })
                    }
                    className="size-4 accent-green-600 align-middle"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={item.unavailable}
                    aria-label="تعذر — لم يتم العثور على الصنف"
                    onChange={(e) =>
                      patchItem(userId, item.name, {
                        unavailable: e.target.checked,
                        ...(e.target.checked ? { completed: false } : {}),
                      })
                    }
                    className="size-4 accent-destructive align-middle"
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  {hasFilters
                    ? "No items match these filters."
                    : hideCompleted && completedCount > 0
                      ? "All requests are completed."
                      : "No custom requests."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
