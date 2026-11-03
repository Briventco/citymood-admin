import { describe, expect, it } from "vitest";
import { canEditArticle, hasPermission, permissionsForRole, type Actor } from "./permissions";

const reporter: Actor = { id: "reporter-1", roles: ["reporter"] };
const editor: Actor = { id: "editor-1", roles: ["editor"] };

describe("backend permissions", () => {
  it("keeps reporters from publishing", () => {
    expect(hasPermission(reporter, "article:publish")).toBe(false);
    expect(permissionsForRole("reporter")).toContain("article:edit:own");
  });

  it("allows editors to publish and edit any article", () => {
    expect(hasPermission(editor, "article:publish")).toBe(true);
    expect(canEditArticle(editor, { id: "article-1", authorId: "reporter-1" })).toBe(true);
  });

  it("limits reporters to their own articles", () => {
    expect(canEditArticle(reporter, { id: "article-1", authorId: "reporter-1" })).toBe(true);
    expect(canEditArticle(reporter, { id: "article-2", authorId: "reporter-2" })).toBe(false);
  });
});
