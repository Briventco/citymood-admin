import { demoSignIn } from "../auth-actions";
import { button } from "../_components/ui";

// Development shortcuts: one-click sign in as CityMood staff roles.
export function DemoSwitcher() {
  const staff = [
    { role: "admin", label: "Publisher (Dr. Akande)" },
    { role: "editor", label: "Senior Editor (Joy Agu)" },
    { role: "reporter", label: "Reporter (Metro Desk)" },
  ] as const;

  return (
    <section aria-labelledby="demo-mode" className="mt-8 border-2 border-dashed border-cm-ad-border bg-cm-paper p-4">
      <h2 id="demo-mode" className="text-[13px] font-extrabold uppercase tracking-[0.1em]">
        Quick sign-in (development):
      </h2>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {staff.map(({ role, label }) => (
          <form key={role} action={demoSignIn.bind(null, role)}>
            <button type="submit" className={button.outline}>
              {label}
            </button>
          </form>
        ))}
      </div>
      <p className="mt-2.5 text-[13px] text-cm-meta">
        Development shortcuts for testing editorial permissions. Any password signs in during development.
      </p>
    </section>
  );
}
