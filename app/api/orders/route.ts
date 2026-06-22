import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db";
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

  const { datasetId, items } = (body ?? {}) as {
    datasetId?: string;
    items?: OrderItem[];
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

  const user = await currentUser();
  const userName =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.username ||
    "Unknown";

  await connectDB();
  await Order.findOneAndUpdate(
    { userId, datasetId },
    { userId, userName, datasetId, items: cleanItems },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({ ok: true, count: cleanItems.length }, { status: 200 });
}
