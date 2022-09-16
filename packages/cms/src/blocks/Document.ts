import type { Block } from "payload/types";

import { isValidURL } from "../lib/validation";

const Document: Block = {
  slug: "document",
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "subtitle",
      type: "text",
    },
    {
      name: "file",
      type: "upload",
      relationTo: "cms-media",
    },
  ],
};

export default Document;
