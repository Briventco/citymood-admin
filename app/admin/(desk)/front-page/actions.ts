"use server";

import { revalidatePath } from "next/cache";
import { staffAction } from "@/lib/admin/session";

// Front page controls. Editors only: the data layer refuses everyone else.
// Each change revalidates the public pages, so the homepage updates at once.

const done = () => {
  revalidatePath("/", "layout");
  return undefined;
};

export async function findLiveStories(search: string) {
  return staffAction(({ repo }) => repo.searchLiveArticles(search, 30));
}

export async function setLeadPin(articleId: string | null) {
  return staffAction(async ({ repo }) => {
    await repo.setPin("lead", articleId);
    return done();
  });
}

export async function arrangeTopStories(articleIds: (string | null)[]) {
  return staffAction(async ({ repo }) => {
    await repo.arrangeTopStories(articleIds);
    return done();
  });
}

export async function setMostRead(articleIds: string[]) {
  return staffAction(async ({ repo }) => {
    await repo.setMostRead(articleIds);
    return done();
  });
}

export async function extendBreaking(articleId: string) {
  return staffAction(async ({ repo }) => {
    await repo.extendBreaking(articleId, 6);
    return done();
  });
}

export async function endBreaking(articleId: string) {
  return staffAction(async ({ repo }) => {
    await repo.endBreaking(articleId);
    return done();
  });
}
