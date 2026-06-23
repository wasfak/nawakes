import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import { CustomRequest, type CustomItem } from "@/models/CustomRequest";
import { MyRequestsView, type MyRequestItem } from "@/components/my-requests-view";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
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
            Sign in to view your request status.
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
  const req = await CustomRequest.findOne({ userId }).lean<{
    items: CustomItem[];
    updatedAt: Date;
  }>();

  const items: MyRequestItem[] = (req?.items ?? []).map((it) => ({
    name: it.name,
    quantity: it.quantity,
    approvedQty: it.approvedQty ?? null,
    completed: it.completed ?? false,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My requests</h1>
          <p className="text-sm text-muted-foreground">
            Track what the admin has approved, reduced, or completed.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to home</Link>
        </Button>
      </div>

      <MyRequestsView
        items={items}
        updatedAt={req?.updatedAt ? req.updatedAt.toISOString() : null}
      />
    </div>
  );
}
