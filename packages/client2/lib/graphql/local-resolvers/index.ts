import type { Resolvers } from "@apollo/client";

import { creditLineResolvers } from "./credit-line";
import {
  directGfiGrantResolvers,
  indirectGfiGrantResolvers,
} from "./gfi-grants";
import { rootQueryResolvers } from "./query";
import { viewerResolvers } from "./viewer";

export const resolvers: Resolvers = {
  Query: rootQueryResolvers,
  Viewer: viewerResolvers,
  CreditLine: creditLineResolvers,
  IndirectGfiGrant: indirectGfiGrantResolvers,
  DirectGfiGrant: directGfiGrantResolvers,
};
