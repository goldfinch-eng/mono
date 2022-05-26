import { utils } from "ethers";

import { USDC_DECIMALS, GFI_DECIMALS, FIDU_DECIMALS } from "@/constants";

import {
  CryptoAmount,
  FiatAmount,
  SupportedCrypto,
} from "../graphql/generated";

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

export function cryptoToFloat(cryptoAmount: CryptoAmount): number {
  switch (cryptoAmount.token) {
    case SupportedCrypto.Usdc:
      const usdcAsFloat = parseFloat(
        utils.formatUnits(cryptoAmount.amount, USDC_DECIMALS)
      );
      return usdcAsFloat;
    case SupportedCrypto.Gfi:
      const gfiAsFloat = parseFloat(
        utils.formatUnits(cryptoAmount.amount, GFI_DECIMALS)
      );
      return gfiAsFloat;
    case SupportedCrypto.Fidu:
      const fiduAsFloat = parseFloat(
        utils.formatUnits(cryptoAmount.amount, FIDU_DECIMALS)
      );
      return fiduAsFloat;
    default:
      throw new Error(
        `Unrecognized crypto (${cryptoAmount.token}) in cryptoToFloat()`
      );
  }
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
}

export function formatCrypto(
  cryptoAmount: CryptoAmount,
  options?: FormatCryptoOptions
): string {
  const defaultOptions: FormatCryptoOptions = {
    includeSymbol: false,
    includeToken: false,
  };
  const { includeSymbol, includeToken } = { ...defaultOptions, ...options };
  switch (cryptoAmount.token) {
    case SupportedCrypto.Usdc:
      return `${includeSymbol ? "$" : ""}${decimalFormatter.format(
        cryptoToFloat(cryptoAmount)
      )}${includeToken ? " USDC" : ""}`;
    case SupportedCrypto.Gfi:
      return `${decimalFormatter.format(cryptoToFloat(cryptoAmount))}${
        includeToken ? " GFI" : ""
      }`;
    case SupportedCrypto.Fidu:
      return `${decimalFormatter.format(cryptoToFloat(cryptoAmount))}${
        includeToken ? " FIDU" : ""
      }`;
    default:
      throw new Error(
        `Unrecognized crypto (${cryptoAmount.token}) in formatCrypto()`
      );
  }
}
