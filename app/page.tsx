import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { ArrowLeft, FileSpreadsheet, LogIn, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import { Dataset, type DatasetRow } from "@/models/Dataset";
import { Order, type OrderItem } from "@/models/Order";
import {
  detectQuantityColumn,
  isNumericColumn,
  type DataRow,
} from "@/lib/dataset";
import { dateRange } from "@/lib/date-filter";
import { OrderTable } from "@/components/order-table";
import { DateFilter } from "@/components/date-filter";
import { CustomRequestForm } from "@/components/custom-request-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ from?: string; to?: string; ds?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <div className="rounded-full bg-muted p-4">
          <LogIn className="size-7 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Sign in required
          </h1>
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

  const { from, to, ds } = await searchParams;
  await connectDB();

  // ── Detail view: only fetch the one selected dataset ──
  if (ds) {
    const dataset = await Dataset.findById(ds).lean<{
      _id: { toString(): string };
      fileName: string;
      columns: string[];
      rows: DatasetRow[];
    }>();

    if (!dataset) {
      const sp = new URLSearchParams();
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      const backHref = sp.toString() ? `/?${sp.toString()}` : "/";

      return (
        <main className="mx-auto max-w-2xl space-y-5 p-6">
          <div className="border-b pb-3">
            <h1 className="text-2xl font-bold tracking-tight">Not found</h1>
            <p className="text-sm text-muted-foreground">
              This sheet was not found.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft /> Back to sheets
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

    const order = await Order.findOne({ userId, datasetId }).lean<{
      items: OrderItem[];
      ignored?: number[];
    }>();
    const initialItems = order?.items ?? [];
    const initialIgnored = order?.ignored ?? [];

    const backSp = new URLSearchParams();
    if (from) backSp.set("from", from);
    if (to) backSp.set("to", to);
    const backHref = backSp.toString() ? `/?${backSp.toString()}` : "/";

    return (
      <div className="mx-auto w-full max-w-7xl space-y-5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="size-8">
              <Link href={backHref}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{fileName}</h1>
              <p className="text-sm text-muted-foreground">
                Mark the items you want, adjust the quantity, then save your
                order.
              </p>
            </div>
          </div>
        </div>

        <OrderTable
          datasetId={datasetId}
          columns={columns}
          rows={dataRows}
          numericColumns={numericColumns}
          quantityColumn={quantityColumn}
          initialItems={initialItems}
          initialIgnored={initialIgnored}
        />
      </div>
    );
  }

  // ── List view ──
  const datasetDocs = await Dataset.find(
    { createdAt: dateRange(from, to) },
    { fileName: 1, columns: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .lean<
      {
        _id: { toString(): string };
        fileName: string;
        columns: string[];
        createdAt: Date;
      }[]
    >();

  const allDatasets = datasetDocs;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Home</h1>
          <p className="text-sm text-muted-foreground">
            {allDatasets.length
              ? `${allDatasets.length} sheet${allDatasets.length === 1 ? "" : "s"} found. Click one to view and order.`
              : "No sheets found for the selected date range."}
          </p>
        </div>
      </div>

      <DateFilter />

      {allDatasets.length === 0 && (
        <Button asChild>
          <Link href="/upload">
            <Upload /> Go to upload
          </Link>
        </Button>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allDatasets.map((d) => {
          const id = d._id.toString();
          const sp = new URLSearchParams();
          if (from) sp.set("from", from);
          if (to) sp.set("to", to);
          sp.set("ds", id);

          return (
            <Link
              key={id}
              href={`/?${sp.toString()}`}
              className="group flex items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <div className="rounded-lg bg-muted p-2.5 group-hover:bg-primary/10">
                <FileSpreadsheet className="size-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {d.columns.length} columns
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(d.createdAt).toLocaleDateString("en-US")}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Custom request */}
      <div className="border-t pt-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Custom request</h2>
            <p className="text-sm text-muted-foreground">
              Need something not on the sheets? Add items manually.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/my-requests">View request status</Link>
          </Button>
        </div>
        <CustomRequestForm />
      </div>
    </div>
  );
}
