import type { CollectionConfig } from "payload/types";

import {
  beforeDealChange,
  afterDealChange,
  afterDealDelete,
  revalidateDeal,
} from "../hooks/deals";

import { isValidURL } from "../lib/validation";
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
      name: "hidden",
      type: "checkbox",
      defaultValue: false,
    },
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
      name: "dealType",
      type: "select",
      defaultValue: "multitranche",
      options: [
        {
          label: "Multitranche",
          value: "multitranche",
        },
        {
          label: "Unitranche",
          value: "unitranche",
        },
      ],
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
      name: "highlights",
      type: "array",
      minRows: 0,
      fields: [
        {
          name: "heading",
          type: "text",
          required: true,
        },
        {
          name: "body",
          type: "richText",
          required: true,
          admin: {
            elements: ["link", "ol", "ul"],
            leaves: ["bold", "italic", "underline"],
          },
        },
      ],
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
    // TODO remove this after new deal page ux goes live. This is unused.
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
      name: "dueDiligenceContact",
      type: "text",
      admin: {
        description:
          "This should be a URL linking to the direct chat with the borrower for due diligence.",
      },
    },
    {
      name: "creditMemos",
      type: "array",
      minRows: 0,
      fields: [
        {
          name: "thumbnail",
          type: "upload",
          relationTo: "media",
        },
        {
          name: "name",
          type: "text",
        },
        {
          name: "subtitle",
          type: "text",
        },
        {
          name: "content",
          type: "textarea",
        },
        {
          name: "date",
          type: "date",
          admin: {
            date: {
              pickerAppearance: "dayOnly",
            },
          },
        },
        {
          name: "fullMemoUrl",
          label: "Full Memo URL",
          type: "text",
          validate: (val) => {
            return isValidURL(val, false);
          },
        },
        {
          name: "executiveSummaryUrl",
          label: "Executive Summary URL",
          type: "text",
          validate: (val) => {
            return isValidURL(val, false);
          },
        },
      ],
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
          type: "richText",
          admin: {
            elements: ["link", "ol", "ul"],
            leaves: ["bold", "italic", "underline"],
          },
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
          type: "richText",
          admin: {
            elements: ["link", "ol", "ul"],
            leaves: ["bold", "italic", "underline"],
          },
          label: "Recourse description",
        },
        // TODO delete this after new deal page ux goes live. This is unused.
        {
          name: "covenants",
          type: "richText",
          admin: {
            elements: ["link", "ol", "ul"],
            leaves: ["bold", "italic", "underline"],
          },
        },
      ],
    },
    // TODO delete this after the new deal page ux goes live. This is unused.
    {
      name: "documents",
      type: "blocks",
      minRows: 0,
      maxRows: 999,
      blocks: [Document],
    },
    {
      ...generateBinarySelect(
        "onChainCapitalPriority",
        "On-chain capital priority",
        [
          { label: "Junior", value: "junior" },
          { label: "Senior", value: "senior" },
        ]
      ),
    },
    {
      ...generateBinarySelect(
        "offChainCapitalPriority",
        "Off-chain capital priority",
        [
          { label: "Junior", value: "junior" },
          { label: "Senior", value: "senior" },
        ]
      ),
    },
    {
      name: "collateralAssets",
      type: "richText",
      admin: {
        elements: ["link", "ol", "ul"],
        leaves: ["bold", "italic", "underline"],
      },
    },
  ],
};

export default Deals;
