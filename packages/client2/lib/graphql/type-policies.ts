import { FieldReadFunction, InMemoryCacheConfig } from "@apollo/client";
import { FixedNumber } from "ethers";

import { goldfinchLogoPngUrl } from "@/components/design-system";
import { POOL_METADATA } from "@/constants";
import { currentUserVar, gfiVar, isWalletModalOpenVar } from "@/lib/state/vars";

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

export const typePolicies: InMemoryCacheConfig["typePolicies"] = {
  Query: {
    fields: {
      currentUser: { read: () => currentUserVar() },
      gfi: { read: () => gfiVar() },
      isWalletModalOpen: { read: () => isWalletModalOpenVar() },
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
          const gfiPriceAsFixedNumber = FixedNumber.fromString(
            gfiPrice.toString()
          );
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
      estimatedJuniorApyFromGfi: {
        read: (_, { readField }) => {
          // Implementation here is really similar to estimatedApyFromGfi on SeniorPoolStatus

          const gfiPrice = gfiVar()?.price.usd;
          if (!gfiPrice) {
            // It's possible that this warning will come up as a false positive, because gfi is added to the Apollo cache in an asynchronous way. This warning might get played even though the end result is eventually correct.
            console.warn(
              "Tried to read estimatedJuniorApyFromGfi but gfi was null. Please include gfi in this query."
            );
            return null;
          }
          const gfiPriceAsFixedNumber = FixedNumber.fromString(
            gfiPrice.toString()
          );
          const estimatedJuniorApyFromGfiRaw = readField({
            fieldName: "estimatedJuniorApyFromGfiRaw",
          });
          if (!estimatedJuniorApyFromGfiRaw) {
            console.warn(
              "Tried to read estimatedJuniorApyFromGfi but estimatedJuniorApyFromGfiRaw was null. Please include estimatedJuniorApyFromGfiRaw in this query."
            );
            return null;
          }
          return gfiPriceAsFixedNumber.mulUnsafe(
            estimatedJuniorApyFromGfiRaw as unknown as FixedNumber
          );
        },
      },
    },
  },
};
