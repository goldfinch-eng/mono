import { FunctionsMap } from "apollo-link-scalars";
import { BigNumber, FixedNumber } from "ethers";

export const typesMap: FunctionsMap = {
  BigInt: {
    serialize: (parsed: unknown): string | null => {
      return parsed instanceof BigNumber ? parsed.toString() : null;
    },
    parseValue: (raw: unknown): BigNumber | null => {
      if (!raw) {
        return null;
      }
      if (typeof raw === "string") {
        return BigNumber.from(raw);
      }
      throw new Error("Invalid value to parse for a BigInt");
    },
  },
  BigDecimal: {
    serialize: (parsed: unknown): string | null => {
      return parsed instanceof FixedNumber ? parsed.toString() : null;
    },
    parseValue: (raw: unknown): FixedNumber | null => {
      if (!raw) {
        return null;
      }
      if (typeof raw === "string") {
        if (!raw.includes(".")) {
          return FixedNumber.fromString(raw);
        }
        const [wholeNumber, decimals] = raw.split(".");
        return FixedNumber.fromString(
          `${wholeNumber}.${decimals.substring(0, 18)}` // The 18 here matches default decimal width (https://docs.ethers.io/v5/api/utils/fixednumber/#FixedFormat--strings)
        );
      }
      throw new Error("Invalid value to parse for a BigDecimal");
    },
  },
};
