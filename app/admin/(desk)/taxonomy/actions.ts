"use server";

import { revalidatePath } from "next/cache";
import { staffAction } from "@/lib/admin/session";

// Categories (admins) and tags (editors). Category names, order and visibility
// feed the public section nav, so every change revalidates the site.

const done = () => {
  revalidatePath("/", "layout");
  return undefined;
};

export async function createCategory(name: string) {
  return staffAction(async ({ repo }) => {
    await repo.createCategory(name);
    return done();
  });
}

export async function updateCategory(id: string, input: { name?: string; is_active?: boolean }) {
  return staffAction(async ({ repo }) => {
    await repo.updateCategory(id, input);
    return done();
  });
}

export async function moveCategory(id: string, direction: -1 | 1) {
  return staffAction(async ({ repo }) => {
    await repo.moveCategory(id, direction);
    return done();
  });
}

export async function renameTag(id: string, name: string) {
  return staffAction(async ({ repo }) => {
    await repo.renameTag(id, name);
    return done();
  });
}

export async function mergeTags(fromId: string, intoId: string) {
  return staffAction(async ({ repo }) => {
    await repo.mergeTags(fromId, intoId);
    return done();
  });
}

export async function deleteTag(id: string) {
  return staffAction(async ({ repo }) => {
    await repo.deleteTag(id);
    return done();
  });
}
