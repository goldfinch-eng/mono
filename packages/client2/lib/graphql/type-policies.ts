import { InMemoryCacheConfig, FieldPolicy } from "@apollo/client";

import { goldfinchLogoPngUrl } from "@/components/design-system";
import {
  isWalletModalOpenVar,
  isVerificationModalOpenVar,
} from "@/lib/state/vars";

const offsetLimitPaginationFieldPolicy: FieldPolicy = {
  keyArgs: ["where", "orderBy", "orderDirection"],
  // merge function reference for offset/limit pagination: https://github.com/apollographql/apollo-client/blob/main/src/utilities/policies/pagination.ts#L33-L49
  merge(existing, incoming, { args }) {
    const merged = existing ? existing.slice(0) : [];
    if (incoming) {
      if (args) {
        const { skip = 0 } = args;
        for (let i = 0; i < incoming.length; ++i) {
          merged[skip + i] = incoming[i];
        }
      } else {
        merged.push(incoming);
      }
    }
    return merged;
  },
};

export const typePolicies: InMemoryCacheConfig["typePolicies"] = {
  Query: {
    fields: {
      isWalletModalOpen: { read: () => isWalletModalOpenVar() },
      isVerificationModalOpen: { read: () => isVerificationModalOpenVar() },
      transactions: offsetLimitPaginationFieldPolicy,
      tranchedPools: offsetLimitPaginationFieldPolicy,
      callableLoans: offsetLimitPaginationFieldPolicy,
      loans: offsetLimitPaginationFieldPolicy,
    },
  },
  SeniorPool: {
    fields: {
      name: { read: () => "Goldfinch Senior Pool" },
      category: { read: () => "Automated diversified portfolio" },
      icon: { read: () => goldfinchLogoPngUrl },
    },
  },
  GfiPrice: {
    keyFields: ["price", ["symbol"]], // The cache ID of gfiPrice is actually the fiat symbol (like USD or CAD)
  },
  Viewer: {
    keyFields: [], // Viewer is a singleton type representing the current viewer, therefore it shouldn't have key fields
  },
  CurvePool: {
    keyFields: [], // CurvePool is a singleton, therefore it shouldn't have key fields
  },
};
