import { Resolvers } from "@apollo/client";

import { goldfinchLogoPngUrl } from "@/components/design-system";
import { BORROWER_METADATA, POOL_METADATA } from "@/constants";

import { TranchedPool } from "../generated";

export const tranchedPoolResolvers: Resolvers[string] = {
  name(tranchedPool: TranchedPool) {
    return POOL_METADATA[tranchedPool.id]?.name ?? `Pool ${tranchedPool.id}`;
  },
  borrowerName(tranchedPool: TranchedPool) {
    const borrowerId = POOL_METADATA[tranchedPool.id]?.borrower;
    if (borrowerId) {
      return BORROWER_METADATA[borrowerId].name;
    }
    return "Borrower";
  },
  borrowerLogo(tranchedPool: TranchedPool) {
    const borrowerId = POOL_METADATA[tranchedPool.id]?.borrower;
    if (borrowerId) {
      return BORROWER_METADATA[borrowerId].logo;
    }
    return goldfinchLogoPngUrl;
  },
};
