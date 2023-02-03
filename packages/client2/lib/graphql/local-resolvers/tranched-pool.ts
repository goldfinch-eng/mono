import { Resolvers } from "@apollo/client";

import { goldfinchLogoPngUrl } from "@/components/design-system";
import { BORROWER_METADATA, POOL_METADATA } from "@/constants";

import { TranchedPool } from "../generated";

export const tranchedPoolResolvers: Resolvers[string] = {
  name(tranchedPool: TranchedPool) {
    return (
      POOL_METADATA[tranchedPool.id as keyof typeof POOL_METADATA]?.name ??
      `Pool ${tranchedPool.id}`
    );
  },
  borrowerName(tranchedPool: TranchedPool) {
    const borrowerId =
      POOL_METADATA[tranchedPool.id as keyof typeof POOL_METADATA]?.borrower;
    if (borrowerId) {
      const borrower =
        BORROWER_METADATA[borrowerId as keyof typeof BORROWER_METADATA];
      if (borrower) {
        return borrower.name;
      }
    }
    return "Borrower";
  },
  borrowerLogo(tranchedPool: TranchedPool) {
    const borrowerId =
      POOL_METADATA[tranchedPool.id as keyof typeof POOL_METADATA]?.borrower;
    if (borrowerId) {
      const borrower =
        BORROWER_METADATA[borrowerId as keyof typeof BORROWER_METADATA];
      if (borrower) {
        return borrower.logo;
      }
    }
    return goldfinchLogoPngUrl;
  },
};
