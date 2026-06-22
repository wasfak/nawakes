import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";

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

export const dynamic = "force-dynamic";

type DatasetLean = {
  _id: { toString(): string };
  fileName: string;
  columns: string[];
  rows: DatasetRow[];
};

type OrderLean = {
  userId: string;
  userName: string;
  datasetId: { toString(): string };
  items: OrderItem[];
  updatedAt: Date;
};

export default async function DashboardPage() {
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

  await connectDB();
  const orders = await Order.find()
    .sort({ updatedAt: -1 })
    .lean<OrderLean[]>();

  const datasetIds = [...new Set(orders.map((o) => o.datasetId.toString()))];
  const datasets = datasetIds.length
    ? await Dataset.find({ _id: { $in: datasetIds } }).lean<DatasetLean[]>()
    : [];
  const dsMap = new Map(datasets.map((d) => [d._id.toString(), d]));

  const totalItems = orders.reduce((n, o) => n + o.items.length, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length.toLocaleString()} order
            {orders.length === 1 ? "" : "s"} · {totalItems.toLocaleString()} line
            item{totalItems === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to ordering</Link>
        </Button>
      </div>

      {orders.length === 0 && (
        <p className="rounded-xl border border-border p-10 text-center text-muted-foreground">
          No orders yet. Go to the{" "}
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            home page
          </Link>{" "}
          to mark items and save an order.
        </p>
      )}

      {/* Group by dataset (catalog). */}
      {datasetIds.map((dsId) => {
        const ds = dsMap.get(dsId);
        if (!ds) return null;

        const groupOrders = orders.filter((o) => o.datasetId.toString() === dsId);
        const { columns, rows, fileName } = ds;
        const dataRows: DataRow[] = rows.map((r, i) => ({ ...r, __id: String(i) }));
        const numericColumns = columns.filter((c) => isNumericColumn(dataRows, c));
        const numericSet = new Set(numericColumns);
        const quantityColumn = detectQuantityColumn(columns, numericColumns);

        return (
          <section key={dsId} className="space-y-2">
            <h2 className="font-semibold">{fileName}</h2>
            <div className="overflow-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-card">
                  <tr>
                    <th className="border-b border-border px-3 py-2 text-center font-semibold">
                      Ordered by
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
                      Ordered qty
                    </th>
                    <th className="border-b border-border px-3 py-2 text-center font-semibold">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupOrders.flatMap((order) =>
                    order.items.map((item) => {
                      const row = rows[item.index];
                      if (!row) return null;
                      const original = quantityColumn
                        ? Number(row[quantityColumn]) || 0
                        : null;
                      const changed =
                        original !== null && item.quantity !== original;

                      return (
                        <tr
                          key={`${order.userId}-${item.index}`}
                          className="border-b border-border last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-3 py-2 text-center font-medium">
                            {order.userName || "Unknown"}
                          </td>
                          {columns.map((col) => {
                            const numeric = numericSet.has(col);
                            const empty = stringify(row[col]) === "";
                            return (
                              <td
                                key={col}
                                className={cn(
                                  "px-3 py-2 text-center align-top",
                                  numeric && "tabular-nums"
                                )}
                              >
                                {empty ? (
                                  <span className="text-muted-foreground/40">—</span>
                                ) : numeric ? (
                                  Number(row[col]).toLocaleString()
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            );
                          })}
                          <td
                            className={cn(
                              "px-3 py-2 text-center font-semibold tabular-nums",
                              changed && "text-primary"
                            )}
                          >
                            {item.quantity.toLocaleString()}
                            {changed && (
                              <span className="block text-xs font-normal text-muted-foreground">
                                was {original!.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground">
                            {new Date(order.updatedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
