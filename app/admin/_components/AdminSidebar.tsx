"use client";

import { FileText, Image as ImageIcon, LayoutPanelTop, Menu, Plus, Settings, Tag, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/app/components/shell/Logo";
import type { Permissions } from "@/lib/admin/repo";
import { initials } from "@/lib/admin/text";
import type { StaffRole } from "@/lib/admin/types";
import { demoSignIn, signOut } from "../auth-actions";
import { Avatar, button } from "./ui";

// ADMIN_SPEC §4 AdminSidebar: black, logo at 72px with "NEWSROOM" in lime, a lime
// "New article" button, nav with the active item marked by a 4px lime left border
// on #1A1A18, and the signed-in user at the bottom. Below 1024px it collapses to a
// top bar with a menu button. Items a role can't use are left out (the pages
// still check the role themselves).

const NAV = [
  { href: "/admin/articles", label: "Articles", icon: FileText, show: () => true },
  { href: "/admin/front-page", label: "Front page", icon: LayoutPanelTop, show: (c: Permissions) => c.editor, also: ["/admin/ads"] },
  { href: "/admin/media", label: "Media library", icon: ImageIcon, show: () => true },
  { href: "/admin/taxonomy", label: "Categories and tags", icon: Tag, show: (c: Permissions) => c.editor },
  { href: "/admin/staff", label: "Staff", icon: User, show: (c: Permissions) => c.admin },
  { href: "/admin/settings", label: "Settings", icon: Settings, show: (c: Permissions) => c.admin },
];

const ROLE_LABEL: Record<StaffRole, string> = { reporter: "Reporter", editor: "Editor", admin: "Admin" };

type Props = { name: string; can: Permissions; demo: boolean };

export function AdminSidebar({ name, can, demo }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  // Close the mobile menu after navigating.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  // The editor has its own full-screen header below 768px (quick publish).
  const inEditor = /^\/admin\/articles\/[^/]+$/.test(pathname);

  return (
    // The outer column runs the full page height; the inner panel stays in view.
    <div className={`cm-on-dark bg-cm-black text-cm-white lg:w-[232px] lg:shrink-0 ${inEditor ? "max-md:hidden" : ""}`}>
      <div className="lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:pt-3 lg:pb-5">
        <div className="flex items-center gap-1 px-4 py-1 lg:py-0">
          <Link href="/admin/articles" className="flex items-center gap-1" aria-label="CityMood Newsroom: articles">
            <Logo height={72} eager alt="" className="h-16 lg:h-[72px]" />
            <span aria-hidden="true" className="text-xs font-extrabold uppercase tracking-[0.16em] text-cm-lime">
              Newsroom
            </span>
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="admin-menu"
            onClick={() => setOpen(!open)}
            className="ml-auto inline-flex min-h-11 items-center gap-2 px-2 text-[15px] font-bold lg:hidden"
          >
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            {open ? "Close" : "Menu"}
          </button>
        </div>

        <div id="admin-menu" className={`${open ? "flex" : "hidden"} flex-col pb-5 lg:flex lg:flex-1 lg:pb-0`}>
          <Link
            href="/admin/articles/new"
            className="mx-4 mt-4 mb-3 flex h-11 items-center justify-center gap-2 bg-cm-lime text-[15px] font-extrabold text-cm-black hover:outline hover:outline-2 hover:outline-cm-white"
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
            New article
          </Link>
          <nav aria-label="Newsroom">
            <ul className="text-[15px] font-bold">
              {NAV.filter((item) => item.show(can)).map(({ href, label, icon: Icon, also }) => {
                const active = [href, ...(also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-11 items-center gap-3 text-cm-white hover:underline ${
                        active ? "border-l-4 border-cm-lime bg-cm-nav-active pl-5" : "pl-6"
                      }`}
                    >
                      <Icon aria-hidden="true" className={`size-[18px] ${active ? "text-cm-lime" : ""}`} strokeWidth={1.8} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-6 border-t border-cm-rule-dark px-6 pt-5 lg:mt-auto">
            <div className="flex items-center gap-2.5">
              <Avatar initials={initials(name)} tone="lime" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{name}</p>
                <p className="text-[13px] text-cm-meta-dark">{ROLE_LABEL[can.role]}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 text-sm">
              <Link href="/" className="inline-flex min-h-11 items-center font-bold text-cm-white underline">
                View live site
              </Link>
              <form action={signOut}>
                <button type="submit" className="inline-flex min-h-11 items-center font-bold text-cm-white underline">
                  Sign out
                </button>
              </form>
            </div>
            {demo && (
              <div className="mt-2 border border-dashed border-cm-meta-dark p-2.5">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-cm-meta-dark">Demo: switch role</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(["reporter", "editor", "admin"] as const).map((role) => (
                    <form key={role} action={demoSignIn.bind(null, role)}>
                      <button type="submit" aria-pressed={can.role === role} className={`${button.onDarkOutline} px-2 text-[13px] aria-pressed:bg-cm-white aria-pressed:text-cm-black`}>
                        {ROLE_LABEL[role]}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
