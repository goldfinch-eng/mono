import * as Privacy from "./privacy.md";
import * as Terms from "./terms.md";

export const pages = ["terms", "privacy"] as const;

type MarkdownPageType = {
  [P in typeof pages[number]]: {
    slug: string;
    content: string;
  };
};

const data: MarkdownPageType = {
  terms: {
    slug: "terms",
    content: Terms,
  },
  privacy: {
    slug: "privacy",
    content: Privacy,
  },
};

export default data;
