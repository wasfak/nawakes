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
    items?: { name: string; approvedQty: number | null; completed: boolean }[];
  };

  if (!userId || !Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await connectDB();
  const doc = await CustomRequest.findOne({ userId }).lean<{
    items: { name: string; quantity: number; approvedQty: number | null; completed: boolean }[];
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
    };
  });

  await CustomRequest.updateOne({ userId }, { $set: { items: newItems } });

  return NextResponse.json({ ok: true }, { status: 200 });
}
