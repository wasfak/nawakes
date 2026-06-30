import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { connectDB } from "@/lib/db";
import { CustomRequest } from "@/models/CustomRequest";

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const { userId, items } = (body ?? {}) as {
    userId?: string;
    items?: {
      name: string;
      approvedQty: number | null;
      completed: boolean;
      unavailable?: boolean;
    }[];
  };

  if (!userId || !Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectDB();
  const doc = await CustomRequest.findOne({ userId }).lean<{
    items: {
      name: string;
      quantity: number;
      approvedQty: number | null;
      completed: boolean;
      unavailable?: boolean;
    }[];
  }>();
  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updateMap = new Map(items.map((u) => [u.name, u]));

  const newItems = doc.items.map((it) => {
    const u = updateMap.get(it.name);
    return {
      name: it.name,
      quantity: it.quantity,
      approvedQty: u
        ? u.approvedQty === null || u.approvedQty === undefined
          ? null
          : Number(u.approvedQty)
        : it.approvedQty ?? null,
      completed: u ? Boolean(u.completed) : it.completed ?? false,
      unavailable: u ? Boolean(u.unavailable) : it.unavailable ?? false,
    };
  });

  await CustomRequest.updateOne({ userId }, { $set: { items: newItems } });

  return NextResponse.json({ ok: true }, { status: 200 });
}

// Admin-only: delete a single requested item (by name) from a user's request.
// If it was the last item, the whole request document is removed.
export async function DELETE(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const name = searchParams.get("name");

  if (!userId || !name) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectDB();
  const doc = await CustomRequest.findOne({ userId });
  if (!doc) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const before = doc.items.length;
  doc.items = doc.items.filter((it: { name: string }) => it.name !== name);

  if (doc.items.length === before) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  if (doc.items.length === 0) {
    await doc.deleteOne();
  } else {
    await doc.save();
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
