import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/session";
import { PageHeader, PermissionDenied, pageClass } from "../../_components/ui";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Site settings" };

export default async function SettingsPage() {
  const { repo, can } = await requireStaff();
  if (!can.admin) {
    return (
      <div className={pageClass}>
        <PermissionDenied need="Only admins can change site settings." />
      </div>
    );
  }
  const s = await repo.getSettings();
  const settings = {
    newsroom_address: s.newsroom_address,
    newsroom_phone: s.newsroom_phone,
    newsroom_email: s.newsroom_email,
    corrections_email: s.corrections_email,
    facebook_url: s.facebook_url,
    instagram_url: s.instagram_url,
    tiktok_url: s.tiktok_url,
  };
  return (
    <div className={pageClass}>
      <PageHeader title="Site settings" note="Shown in the site footer and on the Contact page" />
      <SettingsForm initial={settings} />
    </div>
  );
}
