import type { Resolvers } from "@apollo/client";

import { callableLoanResolvers } from "./callable-loan";
import { creditLineResolvers } from "./credit-line";
import { curvePoolResolvers } from "./curve-pool";
import {
  directGfiGrantResolvers,
  indirectGfiGrantResolvers,
} from "./gfi-grants";
import { poolTokenResolvers } from "./pool-tokens";
import { rootQueryResolvers } from "./query";
import { seniorPoolResolvers } from "./senior-pool";
import { seniorPoolWithdrawalRequestResolvers } from "./senior-pool-withdrawal-request";
import { stakedPositionResolvers } from "./staked-position";
import { tranchedPoolResolvers } from "./tranched-pool";
import { userResolvers } from "./user";
import { viewerResolvers } from "./viewer";

export const resolvers: Resolvers = {
  Query: rootQueryResolvers,
  Viewer: viewerResolvers,
  CreditLine: creditLineResolvers,
  IndirectGfiGrant: indirectGfiGrantResolvers,
  DirectGfiGrant: directGfiGrantResolvers,
  SeniorPoolStakedPosition: stakedPositionResolvers,
  CurvePool: curvePoolResolvers,
  TranchedPool: tranchedPoolResolvers,
  SeniorPoolWithdrawalRequest: seniorPoolWithdrawalRequestResolvers,
  SeniorPool: seniorPoolResolvers,
  User: userResolvers,
  CallableLoan: callableLoanResolvers,
  PoolToken: poolTokenResolvers,
};
