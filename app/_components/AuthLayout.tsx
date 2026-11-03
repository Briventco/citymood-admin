import Link from "next/link";
import { Logo } from "@/app/components/shell/Logo";

// Sign-in split layout (sign-in-1440.png): black brand panel with an 8px lime
// edge, white form. Below 1024px it stacks with the form first.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cm-white lg:flex-row">
      <main className="flex flex-1 items-center justify-center px-6 py-10 lg:basis-[420px] lg:py-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <div className="cm-on-dark order-last flex flex-col justify-between gap-10 border-t-8 border-cm-lime bg-cm-black px-6 py-8 text-cm-white sm:px-12 lg:order-first lg:basis-[380px] lg:grow lg:border-t-0 lg:border-r-8 lg:py-10">
        {/* The PNG has a black margin; pull it left so the mark lines up with the text. */}
        <Logo height={180} eager className="-ml-3 h-[120px] self-start lg:-ml-[18px] lg:h-[180px]" />
        <div>
          <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.16em] text-cm-lime">Newsroom</p>
          <p className="text-lg font-light italic uppercase tracking-cm-tagline">Window to Badagry</p>
        </div>
        <p className="text-sm text-cm-meta-dark">
          For CityMood staff only. Readers can go to the{" "}
          <Link href="/" className="font-bold text-cm-white underline">
            homepage
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
