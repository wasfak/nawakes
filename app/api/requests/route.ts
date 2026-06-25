import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { connectDB } from "@/lib/db";
import { CustomRequest } from "@/models/CustomRequest";

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

  const { items } = (body ?? {}) as {
    items?: { name: string; quantity: number }[];
  };

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid items." }, { status: 400 });
  }

  const cleanItems = items
    .filter(
      (it) =>
        it &&
        typeof it.name === "string" &&
        it.name.trim() &&
        Number.isFinite(Number(it.quantity)),
    )
    .map((it) => ({ name: it.name.trim(), quantity: Number(it.quantity) }));

  const user = await currentUser();
  const userName =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.username ||
    "Unknown";

  await connectDB();

  // ADDITIVE: keep all existing items (incl. approved ones) and merge in new ones.
  const existing = await CustomRequest.findOne({ userId }).lean<{
    items: {
      name: string;
      quantity: number;
      approvedQty: number | null;
      completed: boolean;
      unavailable?: boolean;
    }[];
  }>();

  // Start from existing items, keyed by name.
  const byName = new Map(
    (existing?.items ?? []).map((it) => [
      it.name,
      {
        name: it.name,
        quantity: it.quantity,
        approvedQty: it.approvedQty ?? null,
        completed: it.completed ?? false,
        unavailable: it.unavailable ?? false,
      },
    ]),
  );

  for (const it of cleanItems) {
    const prev = byName.get(it.name);
    if (prev) {
      // Update the requested quantity only while still pending (not yet handled).
      if (prev.approvedQty === null && !prev.completed && !prev.unavailable) {
        prev.quantity = it.quantity;
      }
    } else {
      byName.set(it.name, {
        name: it.name,
        quantity: it.quantity,
        approvedQty: null,
        completed: false,
        unavailable: false,
      });
    }
  }

  const mergedItems = [...byName.values()];

  await CustomRequest.findOneAndUpdate(
    { userId },
    { userId, userName, items: mergedItems },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return NextResponse.json(
    { ok: true, count: mergedItems.length },
    { status: 200 },
  );
}

// Remove one of the user's own items by name. Approved/completed items can't be removed.
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "Missing item name." }, { status: 400 });
  }

  await connectDB();
  const doc = await CustomRequest.findOne({ userId }).lean<{
    items: {
      name: string;
      quantity: number;
      approvedQty: number | null;
      completed: boolean;
    }[];
  }>();
  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const target = doc.items.find((it) => it.name === name);
  if (target && (target.approvedQty !== null || target.completed)) {
    return NextResponse.json(
      { error: "This item was already handled and can't be removed." },
      { status: 400 },
    );
  }

  const remaining = doc.items.filter((it) => it.name !== name);
  await CustomRequest.updateOne({ userId }, { $set: { items: remaining } });

  return NextResponse.json({ ok: true }, { status: 200 });
}
