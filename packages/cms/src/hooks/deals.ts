import payload from "payload";

import type {
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload/types";

import type { CMSDeal, CMSBorrower } from "../generated/payload-types";

export const beforeDealChange: CollectionBeforeChangeHook<CMSDeal> = async ({
  data,
  operation,
}) => {
  // Ensure lowercase address on creation
  if (operation === "create") {
    return { ...data, _id: data.id.toLowerCase(), id: data.id.toLowerCase() };
  }

  return data;
};

export const afterDealChange: CollectionAfterChangeHook<CMSDeal> = async ({
  doc,
  previousDoc,
  operation,
}) => {
  // Get new borrower
  const newBorrower = await payload.findByID<CMSBorrower>({
    collection: "cms-borrowers",
    id: doc.borrower as string,
    depth: 0,
  });

  // Add deal to borrower if it is not there
  if (!(newBorrower.deals || []).includes(doc.id)) {
    await payload.update({
      collection: "cms-borrowers",
      id: newBorrower.id,
      data: {
        deals: [...(newBorrower.deals || []), doc.id],
      },
    });
  }

  // Remove from previous if updating
  if (operation === "update") {
    if (doc.borrower === previousDoc.borrower) {
      return doc;
    }

    const oldBorrower = await payload.findByID<CMSBorrower>({
      collection: "cms-borrowers",
      id: previousDoc.borrower as string,
      depth: 0,
    });

    await payload.update({
      collection: "cms-borrowers",
      id: oldBorrower.id,
      data: {
        deals: (oldBorrower.deals || []).filter((deal) => deal !== doc.id),
      },
    });
  }

  return doc;
};

export const afterDealDelete: CollectionAfterDeleteHook<CMSDeal> = async ({
  id,
  doc,
}) => {
  const borrower = await payload.findByID<CMSBorrower>({
    collection: "cms-borrowers",
    id: doc.borrower as string,
    depth: 0,
  });

  await payload.update({
    collection: "cms-borrowers",
    id: borrower.id,
    data: {
      deals: (borrower.deals || []).filter((deal) => deal !== id),
    },
  });
};
