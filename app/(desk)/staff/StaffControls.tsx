"use client";

import { Fragment, useState, useTransition } from "react";
import type { StaffMember } from "@/lib/admin/repo";
import { initials } from "@/lib/admin/text";
import { formatDayTime } from "@/lib/admin/time";
import { STAFF_ROLES, type StaffRole } from "@/lib/admin/types";
import { ConfirmDialog } from "../../_components/ConfirmDialog";
import { Avatar, Notice, button, inputClass, labelClass, selectClass } from "../../_components/ui";
import { inviteStaff, resendInvite, updateStaff } from "./actions";

const ROLE: Record<StaffRole, string> = { reporter: "Reporter", editor: "Editor", admin: "Admin" };

function lastActive(m: StaffMember, now: Date): string {
  if (!m.is_active) return "Removed";
  if (!m.last_sign_in_at) return "Invited, not joined yet";
  return now.getTime() - Date.parse(m.last_sign_in_at) < 5 * 60_000 ? "Now" : formatDayTime(m.last_sign_in_at, now);
}

export function StaffTable({ staff, meId, now }: { staff: StaffMember[]; meId: string; now: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [role, setRole] = useState<StaffRole>("reporter");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<StaffMember | null>(null);
  const [pending, start] = useTransition();
  const at = new Date(now);

  const run = (fn: () => ReturnType<typeof updateStaff>, success: string) =>
    start(async () => {
      const result = await fn();
      setMessage(result.ok ? { tone: "success", text: success } : { tone: "error", text: result.error });
      if (result.ok) setEditing(null);
      setConfirm(null);
    });

  return (
    <>
      {message && (
        <div className="mb-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      <div className="relative overflow-x-auto border border-cm-rule bg-cm-white">
        <table className="w-full min-w-[600px] border-collapse text-[15px]">
          <caption className="sr-only">Newsroom staff</caption>
          <thead>
            <tr className="border-b-2 border-cm-black text-left text-xs font-extrabold uppercase tracking-[0.1em]">
              <th scope="col" className="px-4 py-3">Name</th>
              <th scope="col" className="px-3 py-3">Role</th>
              <th scope="col" className="px-3 py-3">Last active</th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {staff.map((m) => {
              const invited = m.is_active && !m.last_sign_in_at;
              const open = editing === m.id;
              const self = m.id === meId;
              return (
                <Fragment key={m.id}>
                  <tr className={`border-b border-cm-rule ${open ? "border-b-0" : ""} ${m.is_active ? "" : "text-cm-meta"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={initials(m.full_name || m.email)} />
                        <div className="min-w-0">
                          <p className="font-bold text-cm-black">
                            {m.full_name || "No name yet"}
                            {self && <span className="font-normal text-cm-meta"> (you)</span>}
                          </p>
                          <p className="text-sm break-all text-cm-meta">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{ROLE[m.role]}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-cm-meta">{lastActive(m, at)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-4">
                        {invited && (
                          <button type="button" disabled={pending} onClick={() => run(() => resendInvite(m.id), `Invite sent again to ${m.email}.`)} className="inline-flex min-h-11 items-center font-bold underline">
                            Resend invite<span className="sr-only"> to {m.full_name}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`edit-${m.id}`}
                          onClick={() => {
                            setEditing(open ? null : m.id);
                            setRole(m.role);
                            setMessage(null);
                          }}
                          className="inline-flex min-h-11 items-center font-bold text-cm-black underline"
                        >
                          {open ? "Close" : "Edit"}
                          <span className="sr-only"> {m.full_name}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr id={`edit-${m.id}`} className="border-b border-cm-rule bg-cm-paper">
                      <td colSpan={4} className="px-4 py-4">
                        {self ? (
                          <p className="text-[15px]">You can’t change your own role or remove yourself. Ask another admin.</p>
                        ) : (
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[180px]">
                              <label htmlFor={`role-${m.id}`} className={labelClass}>
                                Role
                              </label>
                              <select id={`role-${m.id}`} value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={selectClass}>
                                {STAFF_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE[r]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              disabled={pending || role === m.role}
                              onClick={() => run(() => updateStaff(m.id, { role }), `${m.full_name} is now ${ROLE[role].toLowerCase() === "admin" ? "an admin" : `a ${ROLE[role].toLowerCase()}`}.`)}
                              className={button.primary}
                            >
                              Save role
                            </button>
                            {m.is_active ? (
                              <button type="button" onClick={() => setConfirm(m)} className={`${button.destructive} ml-auto`}>
                                Remove from the newsroom
                              </button>
                            ) : (
                              <button type="button" disabled={pending} onClick={() => run(() => updateStaff(m.id, { is_active: true }), `${m.full_name} can sign in again.`)} className={`${button.secondary} ml-auto`}>
                                Restore access
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={`Remove ${confirm?.full_name ?? "this person"}?`}
        confirmLabel="Remove"
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && run(() => updateStaff(confirm.id, { is_active: false }), `${confirm.full_name} can no longer sign in.`)}
      >
        They’re signed out and can’t sign in again. Their published stories and bylines stay. You can restore access later.
      </ConfirmDialog>
    </>
  );
}

export function InviteForm() {
  const [form, setForm] = useState({ full_name: "", email: "", role: "reporter" as StaffRole });
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await inviteStaff(form);
          if (result.ok) {
            setMessage({ tone: "success", text: `Invite sent to ${result.data.email}.` });
            setForm({ full_name: "", email: "", role: "reporter" });
          } else setMessage({ tone: "error", text: result.error });
        });
      }}
      className="flex flex-col gap-3.5"
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div>
        <label htmlFor="invite-name" className={labelClass}>
          Name
        </label>
        <input id="invite-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="off" placeholder="As it should appear in bylines" className={inputClass} />
      </div>
      <div>
        <label htmlFor="invite-email" className={labelClass}>
          Email
        </label>
        <input id="invite-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" placeholder="name@example.com" className={inputClass} />
      </div>
      <div>
        <label htmlFor="invite-role" className={labelClass}>
          Role
        </label>
        <select id="invite-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })} className={selectClass}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE[r]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={`${button.primary} w-full`}>
        {pending ? "Sending…" : "Send invite"}
      </button>
      <p className="text-[13px] text-cm-meta">They get an email link to set a password. Links expire after 48 hours.</p>
    </form>
  );
}
