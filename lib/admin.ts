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

// cache() deduplicates within a single request — layout + page calling
// checkAdmin() only hits Clerk once.
export const checkAdmin = cache(async (): Promise<boolean> => {
  const { userId } = await auth();
  if (!userId) return false;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  return isAdminEmail(email);
});
