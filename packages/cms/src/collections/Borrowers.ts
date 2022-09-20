import { CollectionConfig } from "payload/types";

import { isValidURL } from "../lib/validation";

import TeamMember from "../blocks/TeamMember";
import Document from "../blocks/Document";

const Borrowers: CollectionConfig = {
  slug: "borrowers",
  labels: {
    singular: "Borrower",
    plural: "Borrowers",
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name"],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "subheading",
      type: "textarea",
    },
    {
      name: "bio",
      type: "textarea",
    },
    {
      name: "history",
      type: "textarea",
    },
    {
      name: "market",
      type: "textarea",
    },
    {
      name: "website",
      type: "text",
      validate: (val) => {
        return isValidURL(val, false);
      },
    },
    {
      name: "twitter",
      type: "text",
      validate: (val) => {
        return isValidURL(val, false);
      },
    },
    {
      name: "linkedin",
      label: "LinkedIn",
      type: "text",
      validate: (val) => {
        return isValidURL(val, false);
      },
    },
    {
      name: "incorporatedCountry",
      label: "Incorporated in",
      type: "text",
    },
    {
      name: "operatingCountry",
      label: "Operating in",
      type: "text",
    },
    {
      name: "highlights",
      type: "array",
      minRows: 0,
      fields: [
        {
          name: "text",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "borrowerFinancials",
      label: "Borrower Financials",
      type: "group",
      admin: {
        description:
          "These values should include both on-chain and off-chain loans.",
      },
      fields: [
        {
          name: "totalLoansOriginated",
          type: "number",
          label: "Total loans originated to date ($)",
        },
        {
          name: "currentLoansOutstanding",
          type: "number",
          label: "Current loans outstanding ($)",
        },
        {
          name: "aum",
          type: "number",
          label: "Assets Under Management ($)",
        },
        {
          name: "pastOffChainDeals",
          label: "Past deals off-chain",
          type: "array",
          minRows: 0,
          fields: [
            {
              name: "text",
              type: "text",
              required: true,
            },
          ],
        },
        {
          name: "otherProducts",
          label: "Other products offered",
          type: "array",
          minRows: 0,
          fields: [
            {
              name: "text",
              type: "text",
              required: true,
            },
          ],
        },
        {
          name: "projections",
          type: "textarea",
        },
      ],
    },
    {
      name: "underwritingPerformance",
      label: "Underwriting and Performance",
      type: "group",
      fields: [
        {
          name: "performanceDocument",
          label: "Performance document",
          type: "upload",
          relationTo: "media",
        },
        {
          name: "underwritingDescription",
          label: "Underwriting description",
          type: "textarea",
        },
        {
          name: "defaultRate",
          label: "Default rate",
          type: "number",
        },
      ],
    },
    {
      name: "team",
      type: "group",
      fields: [
        {
          name: "description",
          type: "textarea",
        },
        {
          name: "members",
          type: "blocks",
          minRows: 0,
          maxRows: 999,
          blocks: [TeamMember],
        },
      ],
    },
    {
      name: "mediaLinks",
      label: "Media links",
      type: "array",
      minRows: 0,
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
        },
        {
          name: "url",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "contactInfo",
      type: "group",
      fields: [
        {
          name: "description",
          type: "textarea",
        },
        {
          name: "email",
          type: "email",
        },
      ],
    },
    {
      name: "documents",
      type: "blocks",
      minRows: 0,
      maxRows: 999,
      blocks: [Document],
    },
    {
      name: "deals",
      type: "relationship",
      relationTo: "deals",
      hasMany: true,
      admin: {
        disabled: true,
      },
    },
  ],
};

export default Borrowers;
