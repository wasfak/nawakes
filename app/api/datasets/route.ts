import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db";
import { Dataset } from "@/models/Dataset";
import { Order } from "@/models/Order";

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

  const { fileName, columns, rows } = (body ?? {}) as {
    fileName?: string;
    columns?: string[];
    rows?: Record<string, unknown>[];
  };

  if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(rows)) {
    return NextResponse.json(
      { error: "Nothing to save — upload a file first." },
      { status: 400 }
    );
  }

  await connectDB();
  const doc = await Dataset.create({
    userId,
    fileName: fileName?.trim() || "upload",
    columns,
    rows,
  });

  return NextResponse.json(
    { id: String(doc._id), createdAt: doc.createdAt, rows: doc.rows.length },
    { status: 201 }
  );
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid dataset ID." }, { status: 400 });
  }

  await connectDB();
  const deleted = await Dataset.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
  }

  await Order.deleteMany({ datasetId: id });

  return NextResponse.json({ ok: true }, { status: 200 });
}
