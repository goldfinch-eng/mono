import { utils } from "ethers";

import {
  USDC_DECIMALS,
  GFI_DECIMALS,
  FIDU_DECIMALS,
  CURVE_LP_DECIMALS,
} from "@/constants";

import { FiatAmount, SupportedCrypto } from "../graphql/generated";

export function formatFiat(
  fiatAmount: FiatAmount,
  options?: Omit<Intl.NumberFormatOptions, "currency" | "style">
) {
  const defaultOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency: fiatAmount.symbol,
  };
  const formatter = new Intl.NumberFormat("en-US", {
    ...defaultOptions,
    ...options,
  });
  return formatter.format(fiatAmount.amount);
}

// ethers commify() doesn't pad an amount to 2 decimal places, so it just looks weird for a currency. Use this instead
const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const cryptoPrecision: Record<SupportedCrypto, number> = {
  USDC: USDC_DECIMALS,
  GFI: GFI_DECIMALS,
  FIDU: FIDU_DECIMALS,
  CURVE_LP: CURVE_LP_DECIMALS,
};

export function cryptoToFloat(cryptoAmount: CryptoAmount): number {
  return parseFloat(
    utils.formatUnits(cryptoAmount.amount, cryptoPrecision[cryptoAmount.token])
  );
}

interface FormatCryptoOptions {
  /**
   * Whether or not to include a $ sign (USDC only)
   */
  includeSymbol?: boolean;
  /**
   * Whether or not to include the token ticker beside the number
   */
  includeToken?: boolean;
  /**
   * Whether or not to use the maximum precision for this crypto unit. When false, will use precision of 2 decimals places (like a dollar amount).
   */
  useMaximumPrecision?: boolean;
}

export function formatCrypto(
  cryptoAmount: CryptoAmount,
  options?: FormatCryptoOptions
): string {
  const defaultOptions: FormatCryptoOptions = {
    includeSymbol: cryptoAmount.token === "USDC",
    includeToken: cryptoAmount.token !== "USDC",
    useMaximumPrecision: false,
  };
  const { includeSymbol, includeToken, useMaximumPrecision } = {
    ...defaultOptions,
    ...options,
  };
  const float = cryptoToFloat(cryptoAmount);
  const formatter = useMaximumPrecision
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: cryptoPrecision[cryptoAmount.token],
      })
    : decimalFormatter;
  const amount = float > 0 && float < 0.01 ? "<0.01" : formatter.format(float);
  const prefix = cryptoAmount.token === "USDC" && includeSymbol ? "$" : "";
  const suffix = includeToken ? ` ${tokenMap[cryptoAmount.token]}` : "";
  return prefix.concat(amount).concat(suffix);
}

const tokenMap: Record<SupportedCrypto, string> = {
  USDC: "USDC",
  GFI: "GFI",
  FIDU: "FIDU",
  CURVE_LP: "FIDU-USDC-F",
};

export function stringToCryptoAmount(
  s: string | null | undefined,
  token: SupportedCrypto
): CryptoAmount {
  const amount = utils.parseUnits(
    !s ? "0" : s === "" ? "0" : s,
    cryptoPrecision[token]
  );
  return { token, amount };
}
