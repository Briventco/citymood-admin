import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/session";
import { PageHeader, Panel, PermissionDenied, pageClass, panelTitleClass } from "../../_components/ui";
import { InviteForm, StaffTable } from "./StaffControls";

export const metadata: Metadata = { title: "Staff" };

const ROLES = [
  { name: "Reporter", text: "Writes, edits and publishes their own stories, uploads photos, and can mark their own story as breaking." },
  { name: "Editor", text: "Edits, publishes, schedules and unpublishes any story. Runs the front page and breaking ticker." },
  { name: "Admin", text: "Everything an editor can do, plus staff, categories, ad slots and site settings." },
];

export default async function StaffPage() {
  const { repo, me, can } = await requireStaff();
  if (!can.admin) {
    return (
      <div className={pageClass}>
        <PermissionDenied need="Only admins can manage staff." />
      </div>
    );
  }
  const staff = await repo.listStaff();

  return (
    <div className={pageClass}>
      <PageHeader title="Staff" note="Only Admins can see this page" />
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[3_1_520px]">
          <StaffTable staff={staff} meId={me.id} now={new Date().toISOString()} />
          <p className="mt-3 text-[13px] text-cm-meta">Removing someone keeps their published stories and byline.</p>
        </div>
        <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-6">
          <Panel id="invite-h" title="Invite someone">
            <InviteForm />
          </Panel>
          <section aria-labelledby="roles-h" className="cm-on-dark bg-cm-black px-[22px] py-5 text-cm-white">
            <h2 id="roles-h" className={`${panelTitleClass} mb-3`}>
              What each role can do
            </h2>
            <dl className="flex flex-col gap-4">
              {ROLES.map((r) => (
                <div key={r.name}>
                  <dt className="text-base font-extrabold text-cm-lime">{r.name}</dt>
                  <dd className="mt-1 text-[15px] leading-normal">{r.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
