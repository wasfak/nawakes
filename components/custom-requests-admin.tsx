"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminItem {
  name: string;
  quantity: number;
  approvedQty: number | null;
  completed: boolean;
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
  const [saving, setSaving] = React.useState<string | null>(null);

  // Keep local state in sync when the server re-renders fresh data.
  React.useEffect(() => {
    setData(requests);
  }, [requests]);

  const updateItem = (
    userId: string,
    itemName: string,
    field: "approvedQty" | "completed",
    value: number | null | boolean,
  ) => {
    setData((prev) =>
      prev.map((req) =>
        req.userId === userId
          ? {
              ...req,
              items: req.items.map((it) =>
                it.name === itemName ? { ...it, [field]: value } : it,
              ),
            }
          : req,
      ),
    );
  };

  const saveUser = async (userId: string) => {
    const req = data.find((r) => r.userId === userId);
    if (!req) return;
    setSaving(userId);
    try {
      const res = await fetch("/api/requests/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          items: req.items.map((it) => ({
            name: it.name,
            approvedQty: it.approvedQty,
            completed: it.completed,
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      toast.success(`Updated ${req.userName}'s request.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(null);
    }
  };

  if (data.length === 0) return null;

  const totalItems = data.reduce((n, r) => n + r.items.length, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-t pt-5">
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

      {data.map((req) => (
        <div
          key={req.userId}
          className="rounded-xl border border-border overflow-hidden"
        >
          <div className="flex items-center justify-between bg-card px-4 py-2.5 border-b border-border">
            <div>
              <span className="font-medium">{req.userName}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(req.updatedAt).toLocaleDateString("en-US")}
              </span>
            </div>
            <Button
              size="sm"
              disabled={saving === req.userId}
              onClick={() => saveUser(req.userId)}
            >
              {saving === req.userId ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {saving === req.userId ? "Saving..." : "Save"}
            </Button>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
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
              </tr>
            </thead>
            <tbody>
              {req.items.map((item) => (
                <tr
                  key={item.name}
                  className={cn(
                    "border-b border-border last:border-0 hover:bg-muted/40",
                    item.completed && "bg-green-500/5",
                  )}
                >
                  <td
                    className={cn(
                      "px-3 py-2 text-center",
                      item.completed && "line-through opacity-60",
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
                      onChange={(e) =>
                        updateItem(
                          req.userId,
                          item.name,
                          "approvedQty",
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                        )
                      }
                      className={cn(
                        "h-8 w-24 rounded-md border border-border bg-background px-2 text-center text-sm tabular-nums outline-none",
                        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                      )}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) =>
                        updateItem(
                          req.userId,
                          item.name,
                          "completed",
                          e.target.checked,
                        )
                      }
                      className="size-4 accent-green-600 align-middle"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
