"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/get-session";

export type SettingsActionState = {
  error?: string | null;
  success?: boolean;
} | null;

async function requireSession() {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function saveSiteSettings(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  await requireSession();

  try {
    const entries: Record<string, string> = {
      site_name: (formData.get("site_name") as string)?.trim() || "KTM Post",
      site_tagline: (formData.get("site_tagline") as string)?.trim() || "",
      company_name_legal:
        (formData.get("company_name_legal") as string)?.trim() ||
        "डिजी भिजन प्रा. लि., सूचना विभाग द.नं. ५३१६-२०८२/०८३",
      office_address:
        (formData.get("office_address") as string)?.trim() ||
        "Sukedhara, Kathmandu, Nepal",
      contact_email:
        (formData.get("contact_email") as string)?.trim() || "info@ktmpost.com",
      contact_phone:
        (formData.get("contact_phone") as string)?.trim() || "9851320822",
      editor_in_chief: (formData.get("editor_in_chief") as string)?.trim() || "",
      press_reg_no: (formData.get("press_reg_no") as string)?.trim() || "",
      facebook_url: (formData.get("facebook_url") as string)?.trim() || "",
      twitter_url: (formData.get("twitter_url") as string)?.trim() || "",
      youtube_url: (formData.get("youtube_url") as string)?.trim() || "",
      tiktok_url: (formData.get("tiktok_url") as string)?.trim() || "",
    };

    // Upsert each setting key in prisma
    for (const [key, value] of Object.entries(entries)) {
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    // The footer on every page renders site settings.
    revalidatePath("/", "layout");
    revalidatePath("/contact");
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    console.error("Save settings error:", err);
    return { error: err.message || "Failed to save settings" };
  }
}
