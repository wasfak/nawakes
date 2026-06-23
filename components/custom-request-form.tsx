"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Row {
  name: string;
  quantity: number;
}

export function CustomRequestForm() {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>([{ name: "", quantity: 1 }]);
  const [saving, setSaving] = React.useState(false);

  const updateRow = (index: number, field: keyof Row, value: string | number) => {
    setRows((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)),
    );
  };

  const addRow = () => setRows((prev) => [...prev, { name: "", quantity: 1 }]);

  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    const valid = rows.filter((it) => it.name.trim());
    if (valid.length === 0) {
      toast.error("Add at least one item name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: valid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      toast.success(
        `Added ${valid.length} item${valid.length === 1 ? "" : "s"} to your requests.`,
      );
      setRows([{ name: "", quantity: 1 }]); // clear after submit
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Item name"
              value={item.name}
              onChange={(e) => updateRow(i, "name", e.target.value)}
              className={cn(
                "h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            />
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateRow(i, "quantity", Number(e.target.value))}
              className={cn(
                "h-9 w-24 rounded-lg border border-border bg-background px-3 text-center text-sm tabular-nums outline-none",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            />
            {rows.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(i)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-3.5" /> Add row
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {saving ? "Saving..." : "Submit request"}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/my-requests">View my requests</Link>
        </Button>
      </div>
    </div>
  );
}
