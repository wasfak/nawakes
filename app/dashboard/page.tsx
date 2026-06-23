import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { CheckCircle2, Clock, LogIn, Users } from "lucide-react";
import { checkAdmin } from "@/lib/admin";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { connectDB } from "@/lib/db";
import { Dataset, type DatasetRow } from "@/models/Dataset";
import { Order, type OrderItem } from "@/models/Order";
import {
  detectQuantityColumn,
  isNumericColumn,
  stringify,
  type DataRow,
} from "@/lib/dataset";
import { dateRange } from "@/lib/date-filter";
import { DateFilter } from "@/components/date-filter";
import { DashboardSection } from "@/components/dashboard-section";
import { DashboardTable, type DashboardRow } from "@/components/dashboard-table";

export const dynamic = "force-dynamic";

type DatasetLean = {
  _id: { toString(): string };
  fileName: string;
  columns: string[];
  rows: DatasetRow[];
  createdAt: Date;
};

type OrderLean = {
  userId: string;
  userName: string;
  datasetId: { toString(): string };
  items: OrderItem[];
  ignored?: number[];
  updatedAt: Date;
};

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <div className="rounded-full bg-muted p-4">
          <LogIn className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sign in required</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to view the orders dashboard.
          </p>
        </div>
        <SignInButton mode="modal">
          <Button size="lg">
            <LogIn /> Sign in with Google
          </Button>
        </SignInButton>
      </main>
    );
  }

  if (!(await checkAdmin())) redirect("/");

  const { from, to } = await searchParams;

  await connectDB();
  const datasets = await Dataset.find({
    createdAt: dateRange(from, to),
  })
    .sort({ createdAt: -1 })
    .lean<DatasetLean[]>();

  const datasetIds = datasets.map((d) => d._id.toString());

  const orders = datasetIds.length
    ? await Order.find({ datasetId: { $in: datasetIds } })
        .sort({ updatedAt: -1 })
        .lean<OrderLean[]>()
    : [];

  const totalItems = orders.reduce((n, o) => n + o.items.length, 0);
  const totalIgnored = orders.reduce((n, o) => n + (o.ignored?.length ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length.toLocaleString()} order
            {orders.length === 1 ? "" : "s"} &middot;{" "}
            {totalItems.toLocaleString()} line item
            {totalItems === 1 ? "" : "s"}
            {totalIgnored > 0 && (
              <> &middot; {totalIgnored.toLocaleString()} ignored</>
            )}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to ordering</Link>
        </Button>
      </div>

      <DateFilter />

      {datasets.length === 0 && (
        <p className="rounded-xl border border-border p-10 text-center text-muted-foreground">
          No data found for the selected date range.
        </p>
      )}

      {datasets.map((ds) => {
        const dsId = ds._id.toString();
        const groupOrders = orders.filter((o) => o.datasetId.toString() === dsId);
        const { columns, rows, fileName } = ds;
        const dataRows: DataRow[] = rows.map((r, i) => ({ ...r, __id: String(i) }));
        const numericColumns = columns.filter((c) => isNumericColumn(dataRows, c));
        const quantityColumn = detectQuantityColumn(columns, numericColumns);

        // Detect المسئول column and build responder list
        const responsibleCol = columns.find((c) =>
          /مسئول|مسؤول|responsible/i.test(c)
        );
        let responsibleNames: string[] = [];
        const respondedResponsibles = new Set<string>();

        const orderedIndices = new Set<number>();
        const ignoredIndices = new Set<number>();
        for (const o of groupOrders) {
          for (const item of o.items) orderedIndices.add(item.index);
          if (o.ignored) for (const idx of o.ignored) ignoredIndices.add(idx);
        }

        if (responsibleCol) {
          const nameSet = new Set<string>();
          for (const row of rows) {
            const v = stringify(row[responsibleCol]).trim();
            if (v) nameSet.add(v);
          }
          responsibleNames = [...nameSet].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
          );
          const allTouched = new Set([...orderedIndices, ...ignoredIndices]);
          for (const idx of allTouched) {
            const row = rows[idx];
            if (!row) continue;
            const v = stringify(row[responsibleCol]).trim();
            if (v) respondedResponsibles.add(v);
          }
        }

        // Build ALL rows for the table
        const tableRows: DashboardRow[] = [];

        // Ordered items
        for (const order of groupOrders) {
          for (const item of order.items) {
            const row = rows[item.index];
            if (!row) continue;
            const original = quantityColumn
              ? Number(row[quantityColumn]) || 0
              : null;
            const changed = original !== null && item.quantity !== original;
            tableRows.push({
              key: `${order.userId}-item-${item.index}`,
              userName: order.userName || "Unknown",
              status: "ordered",
              cells: row as Record<string, string | number | null>,
              orderedQty: item.quantity,
              originalQty: original,
              changed,
              date: new Date(order.updatedAt).toLocaleDateString(),
            });
          }

          // Ignored items
          if (order.ignored) {
            for (const idx of order.ignored) {
              const row = rows[idx];
              if (!row) continue;
              const original = quantityColumn
                ? Number(row[quantityColumn]) || 0
                : null;
              tableRows.push({
                key: `${order.userId}-ignored-${idx}`,
                userName: order.userName || "Unknown",
                status: "ignored",
                cells: row as Record<string, string | number | null>,
                orderedQty: null,
                originalQty: original,
                changed: false,
                date: new Date(order.updatedAt).toLocaleDateString(),
              });
            }
          }
        }

        // Unreplied rows (not ordered, not ignored by anyone)
        for (let i = 0; i < rows.length; i++) {
          if (orderedIndices.has(i) || ignoredIndices.has(i)) continue;
          const row = rows[i];
          const original = quantityColumn
            ? Number(row[quantityColumn]) || 0
            : null;
          tableRows.push({
            key: `none-${i}`,
            userName: "—",
            status: "none",
            cells: row as Record<string, string | number | null>,
            orderedQty: null,
            originalQty: original,
            changed: false,
            date: "—",
          });
        }

        // Export data
        const exportData: Record<string, unknown>[] = [];
        for (const order of groupOrders) {
          for (const item of order.items) {
            const row = rows[item.index];
            if (!row) continue;
            const exportRow: Record<string, unknown> = { ...row };
            if (quantityColumn) exportRow[quantityColumn] = item.quantity;
            exportData.push(exportRow);
          }
        }

        return (
          <DashboardSection key={dsId} datasetId={dsId} fileName={fileName} exportData={exportData}>
            {/* Responder tracker */}
            {responsibleNames.length > 0 && (
              <div className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4 text-muted-foreground" />
                  <span>
                    Responders &middot;{" "}
                    {responsibleNames.filter((n) =>
                      respondedResponsibles.has(n)
                    ).length}{" "}
                    / {responsibleNames.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {responsibleNames.map((name) => {
                    const responded = respondedResponsibles.has(name);
                    return (
                      <div
                        key={name}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                          responded
                            ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                            : "border-border bg-muted/40 text-muted-foreground"
                        )}
                      >
                        {responded ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <Clock className="size-3.5" />
                        )}
                        <span className={cn(!responded && "opacity-70")}>
                          {name}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            responded
                              ? "text-green-600/70 dark:text-green-400/70"
                              : "text-muted-foreground/60"
                          )}
                        >
                          {responded ? "Responded" : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <DashboardTable
              columns={columns}
              numericColumns={numericColumns}
              quantityColumn={quantityColumn}
              rows={tableRows}
            />
          </DashboardSection>
        );
      })}
    </div>
  );
}
