import payload from "payload";

import type {
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload/types";

import type { Deal, Borrower } from "../generated/payload-types";
import { revalidate } from "../lib/revalidate";

function getDeals(borrower: Borrower): string[] {
  // deals is Deal[] | string[]; types which don't overlap. We use it as a string[]
  // so declare it as such to pacify typescript.
  return (borrower.deals ?? []) as string[];
}

export const beforeDealChange: CollectionBeforeChangeHook<Deal> = async ({
  data,
  operation,
}) => {
  // Ensure lowercase address on creation
  if (operation === "create") {
    return { ...data, _id: data.id.toLowerCase(), id: data.id.toLowerCase() };
  }

  return data;
};

export const afterDealChange: CollectionAfterChangeHook<Deal> = async ({
  doc,
  previousDoc,
  operation,
}) => {
  // Get new borrower
  const newBorrower = await payload.findByID({
    collection: "borrowers",
    id: doc.borrower as string,
    depth: 0,
  });

  const deals = getDeals(newBorrower);

  // Add deal to borrower if it is not there
  if (deals.includes(doc.id)) {
    await payload.update({
      collection: "borrowers",
      id: newBorrower.id,
      data: {
        deals: [...deals, doc.id],
      },
    });
  }

  // Remove from previous if updating
  if (operation === "update") {
    if (doc.borrower === previousDoc.borrower) {
      return doc;
    }

    const oldBorrower = await payload.findByID({
      collection: "borrowers",
      id: previousDoc.borrower as string,
      depth: 0,
    });

    await payload.update({
      collection: "borrowers",
      id: oldBorrower.id,
      data: {
        deals: getDeals(oldBorrower).filter((deal) => deal !== doc.id),
      },
    });
  }

  return doc;
};

export const revalidateDeal: CollectionAfterChangeHook<Deal> = async ({
  doc,
  previousDoc,
  operation,
}) => {
  revalidate(`/pools/${doc.id}`);
  if (
    operation === "create" ||
    (operation === "update" &&
      (doc.name !== previousDoc.name || doc.category !== previousDoc.category))
  ) {
    revalidate("/earn");
  }
};

export const afterDealDelete: CollectionAfterDeleteHook<Deal> = async ({
  id,
  doc,
}) => {
  const borrower = await payload.findByID({
    collection: "borrowers",
    id: doc.borrower as string,
    depth: 0,
  });

  await payload.update({
    collection: "borrowers",
    id: borrower.id,
    data: {
      deals: getDeals(borrower).filter((deal) => deal !== id),
    },
  });
};
