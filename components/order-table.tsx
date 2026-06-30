"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataRow } from "@/components/ui/data-table";

interface OrderTableProps {
  datasetId: string;
  columns: string[];
  rows: DataRow[];
  numericColumns: string[];
  quantityColumn: string | null;
  initialItems: { index: number; quantity: number }[];
  initialIgnored: number[];
}

export function OrderTable({
  datasetId,
  columns,
  rows,
  numericColumns,
  quantityColumn,
  initialItems,
  initialIgnored,
}: OrderTableProps) {
  const numericSet = React.useMemo(
    () => new Set(numericColumns),
    [numericColumns]
  );

  const originalQty = React.useMemo(() => {
    const map: Record<string, number> = {};
    if (quantityColumn) {
      for (const r of rows) map[r.__id] = Number(r[quantityColumn]) || 0;
    }
    return map;
  }, [rows, quantityColumn]);

  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initialItems.map((it) => String(it.index)))
  );
  const [quantities, setQuantities] = React.useState<Record<string, number>>(
    () => {
      const q = { ...originalQty };
      for (const it of initialItems) q[String(it.index)] = it.quantity;
      return q;
    }
  );
  const [ignored, setIgnored] = React.useState<Set<string>>(
    () => new Set(initialIgnored.map(String))
  );
  const [saving, setSaving] = React.useState(false);
  const [confirmBulk, setConfirmBulk] = React.useState(false);

  // Guard against the "select all + save" accident: flag a submit that covers
  // (almost) the whole sheet so the user has to confirm it on purpose.
  const isBulkSubmit =
    rows.length > 5 && selected.size >= Math.ceil(rows.length * 0.9);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleMany = (ids: string[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) (checked ? next.add(id) : next.delete(id));
      return next;
    });

  const toggleIgnore = (id: string) =>
    setIgnored((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setSelected((s) => {
          const ns = new Set(s);
          ns.delete(id);
          return ns;
        });
      }
      return next;
    });

  const save = async () => {
    setConfirmBulk(false);
    setSaving(true);
    try {
      const items = [...selected].map((id) => ({
        index: Number(id),
        quantity: quantities[id] ?? originalQty[id] ?? 0,
      }));
      const ignoredList = [...ignored].map(Number);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId, items, ignored: ignoredList }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save your order.");
      toast.success(
        items.length
          ? `Order saved — ${items.length} item${items.length === 1 ? "" : "s"}${ignoredList.length ? `, ${ignoredList.length} ignored` : ""}. Visit the Dashboard to review.`
          : ignoredList.length
            ? `Order saved — ${ignoredList.length} item${ignoredList.length === 1 ? "" : "s"} ignored.`
            : "Order cleared."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataTable
      columns={columns}
      rows={rows}
      numericColumns={numericSet}
      storageKey={`order-${datasetId}`}
      selection={{
        selectedIds: selected,
        onToggle: toggle,
        onToggleMany: toggleMany,
      }}
      editable={
        quantityColumn
          ? {
              column: quantityColumn,
              getValue: (row) =>
                quantities[row.__id] ?? (Number(row[quantityColumn]) || 0),
              onChange: (id, value) =>
                setQuantities((prev) => ({ ...prev, [id]: value })),
            }
          : undefined
      }
      ignorable={{
        ignoredIds: ignored,
        onToggle: toggleIgnore,
      }}
      rightToolbar={
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
            {ignored.size > 0 && ` · ${ignored.size} ignored`}
          </span>
          {confirmBulk ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Order all {selected.size} items?
              </span>
              <Button
                size="sm"
                className="h-7 px-3"
                disabled={saving}
                onClick={save}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Yes, send"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3"
                disabled={saving}
                onClick={() => setConfirmBulk(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => (isBulkSubmit ? setConfirmBulk(true) : save())}
              disabled={saving}
            >
              {saving ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
              {saving ? "Saving..." : "Save order"}
            </Button>
          )}
        </div>
      }
    />
  );
}
