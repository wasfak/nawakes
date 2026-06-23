import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { checkAdmin } from "@/lib/admin";
import { UploadClient } from "./upload-client";

export default async function UploadPage() {
  const { userId } = await auth();
  if (!userId || !(await checkAdmin())) redirect("/");
  return <UploadClient />;
}
