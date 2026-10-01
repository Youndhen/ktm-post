import { prisma } from "@/lib/prisma";
import SettingsForm from "./SettingsForm";
import { requireStaffPage } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireStaffPage();

  const settingsRecords = await prisma.siteSetting.findMany();
  const settings: Record<string, string> = {};
  for (const record of settingsRecords) {
    settings[record.key] = record.value;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="admin-page-header">
        <h1>Site Settings (वेबसाइट सेटिङ)</h1>
        <p>
          Configure company registration, address, contact details, social channels, and portal branding.
        </p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
