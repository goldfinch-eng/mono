import type { Block } from "payload/types";

import { isValidURL } from "../lib/validation";

const TeamMember: Block = {
  slug: "team-member",
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "position",
      type: "text",
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "linkedin",
      label: "LinkedIn",
      type: "text",
      validate: (val) => {
        return isValidURL(val, false);
      },
    },
  ],
};

export default TeamMember;
