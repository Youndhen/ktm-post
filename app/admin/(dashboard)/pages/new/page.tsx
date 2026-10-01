import { PageForm } from "../PageForm";
import { requireStaffPage } from "@/lib/get-session";

export default async function NewStaticPage() {
  await requireStaffPage();

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1>Create Static Page (नयाँ स्थिर पृष्ठ)</h1>
        <p>Compose a new static page with text, media, and layout configuration.</p>
      </div>

      <PageForm />
    </div>
  );
}
