import { FieldReadFunction, InMemoryCacheConfig } from "@apollo/client";

import { goldfinchLogoPngUrl } from "@/components/design-system";
import { POOL_METADATA, BORROWER_METADATA } from "@/constants";
import { PoolMetadata } from "@/constants/metadata/types";
import {
  isWalletModalOpenVar,
  isVerificationModalOpenVar,
} from "@/lib/state/vars";

function readFieldFromMetadata(
  fieldName: keyof PoolMetadata
): FieldReadFunction {
  return (_, { readField }) => {
    const id = readField({ fieldName: "id" }) as string;
    if (!id) {
      console.warn(
        `Attempted to read the field ${fieldName} but ID was missing. Please include "id" in this query`
      );
      return;
    }
    return POOL_METADATA[id]?.[fieldName] ?? null;
  };
}

export const typePolicies: InMemoryCacheConfig["typePolicies"] = {
  Query: {
    fields: {
      isWalletModalOpen: { read: () => isWalletModalOpenVar() },
      isVerificationModalOpen: { read: () => isVerificationModalOpenVar() },
      transactions: {
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
      },
    },
  },
  SeniorPool: {
    fields: {
      name: { read: () => "Goldfinch Senior Pool" },
      category: { read: () => "Automated diversified portfolio" },
      icon: { read: () => goldfinchLogoPngUrl },
    },
  },
  TranchedPool: {
    fields: {
      name: { read: readFieldFromMetadata("name") },
      description: { read: readFieldFromMetadata("description") },
      highlights: { read: readFieldFromMetadata("highlights") },
      category: { read: readFieldFromMetadata("category") },
      icon: { read: readFieldFromMetadata("icon") },
      agreement: { read: readFieldFromMetadata("agreement") },
      dataroom: { read: readFieldFromMetadata("dataroom") },
      borrower: {
        read: (_, { readField }) => {
          const id = readField({ fieldName: "id" }) as string;
          if (!id) {
            console.warn(
              `Attempted to read the borrower metadata but ID of pool was missing. Please include "id" in this query`
            );
            return;
          }
          const borrowerKey = POOL_METADATA[id].borrower;
          return BORROWER_METADATA[borrowerKey];
        },
      },
    },
  },
  GfiPrice: {
    keyFields: ["price", ["symbol"]], // The cache ID of gfiPrice is actually the fiat symbol (like USD or CAD)
  },
  Viewer: {
    keyFields: [], // Viewer is a singleton type representing the current viewer, therefore it shouldn't have key fields
  },
};
