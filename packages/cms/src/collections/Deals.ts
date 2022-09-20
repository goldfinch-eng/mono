import type { CollectionConfig } from "payload/types";

import {
  beforeDealChange,
  afterDealChange,
  afterDealDelete,
} from "../hooks/deals";

import Document from "../blocks/Document";

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
    afterChange: [afterDealChange],
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
      type: "textarea",
      required: true,
    },
    {
      name: "defaultInterestRate",
      label: "Default Interest Rate",
      type: "number",
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
      name: "useOfFunds",
      label: "Use of funds",
      type: "textarea",
    },
    {
      name: "risks",
      type: "textarea",
    },
    {
      name: "securitiesAndRecourse",
      label: "Securities and Recourse",
      type: "group",
      fields: [
        {
          name: "secured",
          type: "checkbox",
          label: "Secured",
          defaultValue: false,
        },
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
        {
          name: "recourse",
          type: "checkbox",
          label: "Recourse to borrower",
          defaultValue: false,
        },
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
