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
}

export function OrderTable({
  datasetId,
  columns,
  rows,
  numericColumns,
  quantityColumn,
  initialItems,
}: OrderTableProps) {
  const numericSet = React.useMemo(
    () => new Set(numericColumns),
    [numericColumns]
  );

  // Original quantity per row id, used as the default and to detect changes.
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
  const [saving, setSaving] = React.useState(false);

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

  const save = async () => {
    setSaving(true);
    try {
      const items = [...selected].map((id) => ({
        index: Number(id),
        quantity: quantities[id] ?? originalQty[id] ?? 0,
      }));
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId, items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save your order.");
      toast.success(
        items.length
          ? `Order saved — ${items.length} item${items.length === 1 ? "" : "s"}. Visit the Dashboard to review.`
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
      rightToolbar={
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
            {saving ? "Saving…" : "Save order"}
          </Button>
        </div>
      }
    />
  );
}
