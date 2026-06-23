"use client";

import * as React from "react";
import { EyeOff, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DashboardRow {
  key: string;
  userName: string;
  status: "ordered" | "ignored" | "none";
  cells: Record<string, string | number | null>;
  orderedQty: number | null;
  originalQty: number | null;
  changed: boolean;
  date: string;
}

interface DashboardTableProps {
  columns: string[];
  numericColumns: string[];
  quantityColumn: string | null;
  rows: DashboardRow[];
}

type ViewMode = "all" | "replied";

export function DashboardTable({
  columns,
  numericColumns,
  quantityColumn,
  rows,
}: DashboardTableProps) {
  const [view, setView] = React.useState<ViewMode>("all");
  const numericSet = new Set(numericColumns);

  const visible =
    view === "replied"
      ? rows.filter((r) => r.status !== "none")
      : rows;

  const repliedCount = rows.filter((r) => r.status !== "none").length;

  return (
    <>
      <div className="flex items-center gap-2">
        <Filter className="size-3.5 text-muted-foreground" />
        <Button
          variant={view === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("all")}
        >
          All items ({rows.length})
        </Button>
        <Button
          variant={view === "replied" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("replied")}
        >
          Replied only ({repliedCount})
        </Button>
      </div>

      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Ordered by
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Status
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-border px-3 py-2 text-center font-semibold"
                >
                  {col}
                </th>
              ))}
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                {quantityColumn
                  ? `${quantityColumn} (original)`
                  : "Original qty"}
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-semibold">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isOrdered = row.status === "ordered";
              const isIgnored = row.status === "ignored";
              const isNone = row.status === "none";

              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b border-border last:border-0",
                    isOrdered && "hover:bg-muted/40",
                    isIgnored && "bg-destructive/5 opacity-60",
                    isNone && "bg-muted/20 opacity-50",
                  )}
                >
                  <td className="px-3 py-2 text-center font-medium">
                    {row.userName}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isOrdered && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Ordered
                      </span>
                    )}
                    {isIgnored && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        <EyeOff className="size-3" />
                        Ignored
                      </span>
                    )}
                    {isNone && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        No reply
                      </span>
                    )}
                  </td>
                  {columns.map((col) => {
                    const numeric = numericSet.has(col);
                    const val = row.cells[col];
                    const empty =
                      val === null ||
                      val === undefined ||
                      String(val).trim() === "";
                    const isQtyCol = col === quantityColumn;

                    return (
                      <td
                        key={col}
                        className={cn(
                          "px-3 py-2 text-center align-top",
                          numeric && "tabular-nums",
                          isIgnored && "line-through",
                          isQtyCol &&
                            isOrdered &&
                            row.changed &&
                            "font-semibold text-primary",
                        )}
                      >
                        {isQtyCol && isOrdered ? (
                          <>
                            {row.orderedQty!.toLocaleString("en-US")}
                            {row.changed && (
                              <span className="block text-xs font-normal text-muted-foreground">
                                was{" "}
                                {row.originalQty!.toLocaleString("en-US")}
                              </span>
                            )}
                          </>
                        ) : empty ? (
                          <span className="text-muted-foreground/40">
                            —
                          </span>
                        ) : numeric ? (
                          Number(val).toLocaleString("en-US")
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={cn(
                      "px-3 py-2 text-center tabular-nums",
                      isIgnored && "line-through",
                    )}
                  >
                    {row.originalQty !== null
                      ? row.originalQty.toLocaleString("en-US")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {row.date}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 4}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No items to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
