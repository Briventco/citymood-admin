import type { Category } from "./types";

// Default seed, in the order of DESIGN_SPEC.md §4.2. A CMS should own this list.
export const defaultCategories: Category[] = [
  { slug: "local-news", name: "Local News", shortName: "Local", order: 1 },
  { slug: "community-people", name: "Community & People", shortName: "Community", order: 2 },
  { slug: "business-development", name: "Business & Development", shortName: "Business", order: 3 },
  { slug: "politics-public-affairs", name: "Politics & Public Affairs", shortName: "Politics", order: 4 },
  { slug: "culture-events", name: "Culture & Events", shortName: "Culture", order: 5 },
  { slug: "tourism-heritage", name: "Tourism & Heritage", shortName: "Heritage", order: 6 },
];
