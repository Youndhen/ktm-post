import ImportManager from "./ImportManager";
import { requireStaffPage } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  await requireStaffPage();

  return <ImportManager />;
}
