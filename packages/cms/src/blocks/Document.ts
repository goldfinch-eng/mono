import type { Block } from "payload/types";

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
      relationTo: "media",
    },
  ],
};

export default Document;
