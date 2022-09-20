import { Resolvers } from "@apollo/client";

import { BORROWER_METADATA, POOL_METADATA } from "@/constants";

import { TranchedPool } from "../generated";

export const tranchedPoolResolvers: Resolvers[string] = {
  name(tranchedPool: TranchedPool) {
    return POOL_METADATA[tranchedPool.id].name;
  },
  icon(tranchedPool: TranchedPool) {
    return POOL_METADATA[tranchedPool.id].icon;
  },
  borrowerName(tranchedPool: TranchedPool) {
    const borrowerId = POOL_METADATA[tranchedPool.id].borrower;
    return BORROWER_METADATA[borrowerId].name;
  },
  borrowerLogo(tranchedPool: TranchedPool) {
    const borrowerId = POOL_METADATA[tranchedPool.id].borrower;
    return BORROWER_METADATA[borrowerId].logo;
  },
};
