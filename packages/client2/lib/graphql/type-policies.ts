import { FieldReadFunction, InMemoryCacheConfig } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { goldfinchLogoPngUrl } from "@/components/logo";
import { POOL_METADATA } from "@/constants";

import { currentUserVar } from "./local-state/vars";

function readFieldFromMetadata(
  fieldName: string,
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

function readAsBigNumber(n?: string) {
  if (!n) {
    return null;
  }
  return BigNumber.from(n);
}

function readAsFixedNumber(n?: string) {
  if (!n) {
    return null;
  } else if (!n.includes(".")) {
    return FixedNumber.fromString(n);
  }
  const [wholeNumber, decimals] = n.split(".");
  const decimalWidth = 32; // This number was chosen arbitrarily. It seems precise enough for any math the frontend would have to do for displaying data to users, while not being limitless
  return FixedNumber.fromString(
    `${wholeNumber}.${decimals.substring(0, decimalWidth)}`,
    decimalWidth
  );
}

export const typePolicies: InMemoryCacheConfig["typePolicies"] = {
  Query: {
    fields: {
      currentUser: { read: () => currentUserVar() },
      user: {
        keyArgs: ["id"], // This is done to make sure that user data isn't keyed with `block`. Latest should always overwrite
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
  SeniorPoolStatus: {
    fields: {
      totalPoolAssets: { read: readAsBigNumber },
      estimatedApy: { read: readAsFixedNumber },
    },
  },
  SeniorPoolDeposit: {
    fields: {
      amount: { read: readAsBigNumber },
    },
  },
  TranchedPool: {
    fields: {
      name: { read: readFieldFromMetadata("name") },
      description: { read: readFieldFromMetadata("description") },
      category: { read: readFieldFromMetadata("category") },
      icon: { read: readFieldFromMetadata("icon") },
    },
  },
};
