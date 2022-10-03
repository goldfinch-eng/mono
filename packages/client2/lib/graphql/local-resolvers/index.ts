import type { Resolvers } from "@apollo/client";

import { backerSecondaryMarketResolvers } from "./backer-secondary-market";
import { creditLineResolvers } from "./credit-line";
import { curvePoolResolvers } from "./curve-pool";
import {
  directGfiGrantResolvers,
  indirectGfiGrantResolvers,
} from "./gfi-grants";
import { rootQueryResolvers } from "./query";
import { stakedPositionResolvers } from "./staked-position";
import { tranchedPoolResolvers } from "./tranched-pool";
import { viewerResolvers } from "./viewer";

export const resolvers: Resolvers = {
  Query: rootQueryResolvers,
  Viewer: viewerResolvers,
  BackerSecondaryMarket: backerSecondaryMarketResolvers,
  CreditLine: creditLineResolvers,
  IndirectGfiGrant: indirectGfiGrantResolvers,
  DirectGfiGrant: directGfiGrantResolvers,
  SeniorPoolStakedPosition: stakedPositionResolvers,
  CurvePool: curvePoolResolvers,
  TranchedPool: tranchedPoolResolvers,
};
