import type { CollectionAfterChangeHook } from "payload/types";

import type { Borrower } from "../generated/payload-types";
import { revalidate } from "../lib/revalidate";

export const afterBorrowerChange: CollectionAfterChangeHook<Borrower> = async ({
  doc,
  previousDoc,
  operation,
}) => {
  if (operation === "update" && doc.deals && doc.deals.length > 0) {
    for (let i = 0; i < doc.deals.length; i++) {
      const deal = doc.deals[i];
      if (typeof deal === "string") {
        revalidate(`/pools/${deal}`);
      }
    }
    // Changing the logo should cause the /earn page to revalidate
    if (doc.logo !== previousDoc.logo) {
      revalidate("/earn");
    }
  }
};
