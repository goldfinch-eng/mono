import type { CollectionConfig } from "payload/types";

import {
  beforeDealChange,
  afterDealChange,
  afterDealDelete,
  revalidateDeal,
} from "../hooks/deals";

import Document from "../blocks/Document";
import { generateBinarySelect } from "../lib/binary-select";

const Deals: CollectionConfig = {
  slug: "deals",
  labels: {
    singular: "Deal",
    plural: "Deals",
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "borrower", "id"],
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [beforeDealChange],
    afterChange: [afterDealChange, revalidateDeal],
    afterDelete: [afterDealDelete],
  },
  fields: [
    {
      name: "id",
      label: "Contract Address",
      type: "text",
      admin: {
        description:
          "NOTE: The Contract Address field CANNOT be changed after the deal is created.",
      },
      required: true,
      unique: true,
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "category",
      type: "text",
      required: true,
    },
    {
      name: "borrower",
      type: "relationship",
      relationTo: "borrowers",
      hasMany: false,
      required: true,
    },
    {
      name: "overview",
      type: "richText",
      required: true,
      admin: {
        description: "This content will appear near the top of the page.",
        elements: ["h3", "h4", "h5", "link", "ol", "ul"],
        leaves: ["bold", "italic", "underline"],
      },
    },
    {
      name: "defaultInterestRate",
      label: "Default Interest Rate",
      type: "number",
    },
    {
      name: "details",
      type: "richText",
      admin: {
        description:
          'This content will appear after the "Recent activity" table',
        elements: ["h3", "h4", "h5", "link", "ol", "ul"],
        leaves: ["bold", "italic", "underline"],
      },
    },
    { name: "transactionStructure", type: "upload", relationTo: "media" },
    {
      name: "agreement",
      type: "text",
      admin: {
        description:
          "This should be a URL linking to the agreement for this deal.",
      },
    },
    {
      name: "dataroom",
      type: "text",
      admin: {
        description:
          "This should be a URL linking to the dataroom for this deal.",
      },
    },
    {
      name: "securitiesAndRecourse",
      label: "Securities and Recourse",
      type: "group",
      fields: [
        generateBinarySelect("secured"),
        {
          name: "type",
          type: "text",
          label: "Type of security",
        },
        {
          name: "description",
          type: "textarea",
          label: "Security description",
        },
        {
          name: "value",
          type: "number",
          label: "Loan to Value ratio",
        },
        generateBinarySelect("recourse", "Recourse to borrower"),
        {
          name: "recourseDescription",
          type: "textarea",
          label: "Recourse description",
        },
        {
          name: "covenants",
          type: "textarea",
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
  ],
};

export default Deals;
