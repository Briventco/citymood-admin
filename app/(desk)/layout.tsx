import { demoMode } from "@/lib/admin/backend";
import { requireStaff } from "@/lib/admin/session";
import { AdminSidebar } from "../_components/AdminSidebar";

// The signed-in newsroom: black sidebar, light grey work area with white panels.
export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const { me, can } = await requireStaff();
  return (
    <div className="min-h-screen bg-cm-paper lg:flex">
      <a href="#admin-main" className="cm-skip-link">
        Skip to main content
      </a>
      <AdminSidebar name={me.full_name || me.email} can={can} demo={demoMode} />
      <main id="admin-main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
