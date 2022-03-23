import { FieldReadFunction, InMemoryCacheConfig } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { goldfinchLogoPngUrl } from "@/components/logo";
import { POOL_METADATA } from "@/constants";

import { currentUserVar, gfiVar } from "./local-state/vars";

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

function readAsFixedNumber(n?: string | FixedNumber) {
  const decimalWidth = 32; // This number was chosen arbitrarily. It seems precise enough for any math the frontend would have to do for displaying data to users, while not being limitless
  if (!n) {
    return null;
  } else if (n instanceof FixedNumber) {
    return n;
  } else if (!n.includes(".")) {
    return FixedNumber.fromString(n, decimalWidth);
  }
  const [wholeNumber, decimals] = n.split(".");
  return FixedNumber.fromString(
    `${wholeNumber}.${decimals.substring(0, decimalWidth)}`,
    decimalWidth
  );
}

export const typePolicies: InMemoryCacheConfig["typePolicies"] = {
  Query: {
    fields: {
      currentUser: { read: () => currentUserVar() },
      gfi: { read: () => gfiVar() },
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
      totalPoolAssetsUsdc: { read: readAsBigNumber },
      estimatedApy: { read: readAsFixedNumber },
      estimatedApyFromGfiRaw: { read: readAsFixedNumber },
      estimatedApyFromGfi: {
        read: (_, { readField }) => {
          const gfiPrice = gfiVar()?.price.usd;
          if (!gfiPrice) {
            // It's possible that this warning will come up as a false positive, because gfi is added to the Apollo cache in an asynchronous way. This warning might get played even though the end result is eventually correct.
            console.warn(
              "Tried to read estimatedApyFromGfi but gfi was null. Please include gfi in this query."
            );
            return null;
          }
          const gfiPriceAsFixedNumber = readAsFixedNumber(
            gfiPrice.toString()
          ) as FixedNumber;
          const estimatedApyFromGfiRaw = readField({
            fieldName: "estimatedApyFromGfiRaw",
          });
          if (!estimatedApyFromGfiRaw) {
            console.warn(
              "Tried to read estimatedApyFromGfi but estimatedApyFromGfiRaw was null. Please include estimatedApyFromGfiRaw in this query."
            );
            return null;
          }
          return gfiPriceAsFixedNumber.mulUnsafe(
            estimatedApyFromGfiRaw as unknown as FixedNumber
          );
        },
      },
      earnRatePerTokenPerYear: { read: readAsBigNumber },
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
