import { FieldReadFunction, InMemoryCacheConfig } from "@apollo/client";

import { goldfinchLogoPngUrl } from "@/components/design-system";
import { POOL_METADATA } from "@/constants";
import { PoolMetadata } from "@/constants/metadata/types";
import {
  isWalletModalOpenVar,
  isUIDModalOpenVar,
  isKYCModalOpenVar,
  isKYCDoneVar,
} from "@/lib/state/vars";

function readFieldFromMetadata(
  fieldName: keyof PoolMetadata,
  fallback: any = null
): FieldReadFunction {
  return (_, { readField }) => {
    const id = readField({ fieldName: "id" }) as string;
    if (!id) {
      console.warn(
        `Attempted to read the field ${fieldName} but ID was missing. Please include "id" in this query`
      );
      return;
    }
    return POOL_METADATA[id]?.[fieldName] ?? fallback;
  };
}

export const typePolicies: InMemoryCacheConfig["typePolicies"] = {
  Query: {
    fields: {
      isWalletModalOpen: { read: () => isWalletModalOpenVar() },
      isKYCModalOpen: { read: () => isKYCModalOpenVar() },
      isUIDModalOpen: { read: () => isUIDModalOpenVar() },
      isKYCDone: { read: () => isKYCDoneVar() },
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
      category: { read: readFieldFromMetadata("category") },
      icon: { read: readFieldFromMetadata("icon") },
      agreement: { read: readFieldFromMetadata("agreement") },
      dataroom: { read: readFieldFromMetadata("dataroom") },
      poolDescription: { read: readFieldFromMetadata("poolDescription") },
      poolHighlights: { read: readFieldFromMetadata("poolHighlights") },
      borrowerDescription: {
        read: readFieldFromMetadata("borrowerDescription"),
      },
      borrowerHighlights: { read: readFieldFromMetadata("borrowerHighlights") },
    },
  },
  GfiPrice: {
    keyFields: ["price", ["symbol"]],
  },
  Viewer: {
    keyFields: [], // Viewer is a singleton type representing the current viewer, therefore it shouldn't have key fields
  },
};
