import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase());
}

// Raw check — safe to call from route handlers / server actions.
export async function isAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress;
    return isAdminEmail(email);
  } catch (e) {
    console.error("isAdmin check failed:", e);
    return false;
  }
}

// cache() deduplicates within a single render pass (layout + page).
// Use only from Server Components.
export const checkAdmin = cache(isAdmin);
