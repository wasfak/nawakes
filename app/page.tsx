import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { LogIn, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import { Dataset, type DatasetRow } from "@/models/Dataset";
import { Order, type OrderItem } from "@/models/Order";
import { detectQuantityColumn, isNumericColumn, type DataRow } from "@/lib/dataset";
import { OrderTable } from "@/components/order-table";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { userId } = await auth();

  // Gate: the home page is not accessible until the user signs in.
  if (!userId) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <div className="rounded-full bg-muted p-4">
          <LogIn className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sign in required</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your Google account to place your order.
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
  // The catalog everyone orders from is the most recently uploaded dataset.
  const dataset = await Dataset.findOne()
    .sort({ createdAt: -1 })
    .lean<{
      _id: { toString(): string };
      fileName: string;
      columns: string[];
      rows: DatasetRow[];
      createdAt: Date;
    }>();

  if (!dataset) {
    return (
      <main className="mx-auto max-w-2xl space-y-5 p-6">
        <div className="border-b pb-3">
          <h1 className="text-2xl font-bold tracking-tight">Home</h1>
          <p className="text-sm text-muted-foreground">
            No catalog yet. Upload a spreadsheet and press “Send” to start ordering.
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Upload /> Go to upload
          </Link>
        </Button>
      </main>
    );
  }

  const datasetId = dataset._id.toString();
  const { fileName, columns, rows } = dataset;

  const dataRows: DataRow[] = rows.map((r, i) => ({ ...r, __id: String(i) }));
  const numericColumns = columns.filter((c) => isNumericColumn(dataRows, c));
  const quantityColumn = detectQuantityColumn(columns, numericColumns);

  // This user's existing order for the catalog (so marks/quantities persist).
  const order = await Order.findOne({ userId, datasetId })
    .lean<{ items: OrderItem[] }>();
  const initialItems = order?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fileName}</h1>
          <p className="text-sm text-muted-foreground">
            Mark the items you want, adjust the quantity, then save your order.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">View dashboard</Link>
        </Button>
      </div>

      <OrderTable
        datasetId={datasetId}
        columns={columns}
        rows={dataRows}
        numericColumns={numericColumns}
        quantityColumn={quantityColumn}
        initialItems={initialItems}
      />
    </div>
  );
}
