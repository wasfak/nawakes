import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { stringify } from "@/lib/dataset";
import { Dataset, type DatasetRow } from "@/models/Dataset";
import { Order, type OrderItem } from "@/models/Order";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { datasetId, items, ignored } = (body ?? {}) as {
    datasetId?: string;
    items?: OrderItem[];
    ignored?: number[];
  };

  if (!datasetId || !Types.ObjectId.isValid(datasetId) || !Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  // Sanitize: keep only valid {index, quantity} pairs.
  const cleanItems = items
    .filter(
      (it) =>
        it &&
        Number.isInteger(it.index) &&
        it.index >= 0 &&
        Number.isFinite(Number(it.quantity))
    )
    .map((it) => ({ index: it.index, quantity: Number(it.quantity) }));

  const cleanIgnored = (Array.isArray(ignored) ? ignored : [])
    .filter((i) => Number.isInteger(i) && i >= 0);

  // An index can never be both ordered and ignored. If the client sends both,
  // ignore wins — drop it from the ordered items so it can't show as ordered.
  const ignoredSet = new Set(cleanIgnored);
  const dedupedItems = cleanItems.filter((it) => !ignoredSet.has(it.index));

  const user = await currentUser();
  const userName =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.username ||
    "Unknown";

  await connectDB();
  await Order.findOneAndUpdate(
    { userId, datasetId },
    { userId, userName, datasetId, items: dedupedItems, ignored: cleanIgnored },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({ ok: true, count: dedupedItems.length }, { status: 200 });
}

// Admin-only: trim a user's order down to the rows they are actually
// responsible for — keep only items/ignored whose المسئول column equals the
// given value, deleting everything else. Fixes "marked & sent everything by
// accident" without forcing the user to resubmit.
export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { datasetId, userId: targetUserId, responsibleColumn, keep } =
    (body ?? {}) as {
      datasetId?: string;
      userId?: string;
      responsibleColumn?: string;
      keep?: string;
    };

  if (
    !datasetId ||
    !Types.ObjectId.isValid(datasetId) ||
    !targetUserId ||
    !responsibleColumn ||
    typeof keep !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectDB();

  const dataset = await Dataset.findById(datasetId)
    .lean<{ rows: DatasetRow[] }>();
  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
  }

  const order = await Order.findOne({ userId: targetUserId, datasetId });
  if (!order) {
    return NextResponse.json({ error: "No order found for this user." }, { status: 404 });
  }

  const keepNorm = keep.trim();
  const rows = dataset.rows;
  const matches = (index: number) => {
    const row = rows[index];
    if (!row) return false;
    return stringify(row[responsibleColumn]) === keepNorm;
  };

  const beforeItems = order.items.length;
  const beforeIgnored = order.ignored?.length ?? 0;

  order.items = order.items.filter((it: OrderItem) => matches(it.index));
  order.ignored = (order.ignored ?? []).filter((idx: number) => matches(idx));

  if (order.items.length === 0 && order.ignored.length === 0) {
    // Nothing left that belongs to them — drop the order entirely.
    await order.deleteOne();
  } else {
    await order.save();
  }

  return NextResponse.json(
    {
      ok: true,
      removedItems: beforeItems - order.items.length,
      removedIgnored: beforeIgnored - order.ignored.length,
      remaining: order.items.length,
    },
    { status: 200 }
  );
}

// Admin-only: reset (delete) a single user's order for a dataset, so they can
// resubmit from scratch — e.g. someone marked & sent everything by accident.
export async function DELETE(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const datasetId = searchParams.get("datasetId");
  const targetUserId = searchParams.get("userId");

  if (!datasetId || !Types.ObjectId.isValid(datasetId) || !targetUserId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectDB();
  const deleted = await Order.findOneAndDelete({
    userId: targetUserId,
    datasetId,
  });

  if (!deleted) {
    return NextResponse.json({ error: "No order found for this user." }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
