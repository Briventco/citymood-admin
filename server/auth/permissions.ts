import type { Article } from "@/lib/content";

export const roles = ["reporter", "editor", "ad_manager", "administrator"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "article:create",
  "article:edit:own",
  "article:edit:any",
  "article:submit",
  "article:publish",
  "article:unpublish",
  "article:correct",
  "article:feature",
  "article:break",
  "category:manage",
  "tag:manage",
  "media:upload",
  "ad:manage",
  "analytics:view",
  "user:manage",
  "system:manage",
] as const;
export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, readonly Permission[]> = {
  reporter: ["article:create", "article:edit:own", "article:submit", "media:upload"],
  editor: [
    "article:create",
    "article:edit:any",
    "article:submit",
    "article:publish",
    "article:unpublish",
    "article:correct",
    "article:feature",
    "article:break",
    "category:manage",
    "tag:manage",
    "media:upload",
    "analytics:view",
  ],
  ad_manager: ["media:upload", "ad:manage", "analytics:view"],
  administrator: permissions,
};

export type Actor = {
  id: string;
  roles: readonly Role[];
};

export function hasPermission(actor: Actor, permission: Permission): boolean {
  return actor.roles.some((role) => rolePermissions[role].includes(permission));
}

export function canEditArticle(actor: Actor, article: Pick<Article, "id"> & { authorId?: string }): boolean {
  if (hasPermission(actor, "article:edit:any")) return true;
  return article.authorId === actor.id && hasPermission(actor, "article:edit:own");
}

export function permissionsForRole(role: Role): readonly Permission[] {
  return rolePermissions[role];
}
