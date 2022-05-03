import { utils } from "ethers";

import { USDC_DECIMALS, GFI_DECIMALS } from "@/constants";

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

interface FormatCryptoOptions {
  includeSymbol?: boolean;
}

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
    default:
      throw new Error(
        `Unrecognized crypto (${cryptoAmount.token}) in cryptoToFloat()`
      );
  }
}

export function formatCrypto(
  cryptoAmount: CryptoAmount,
  options?: FormatCryptoOptions
): string {
  const defaultOptions: FormatCryptoOptions = { includeSymbol: true };
  const { includeSymbol } = { ...defaultOptions, ...options };
  switch (cryptoAmount.token) {
    case SupportedCrypto.Usdc:
      return `${decimalFormatter.format(cryptoToFloat(cryptoAmount))}${
        includeSymbol ? " USDC" : ""
      }`;
    case SupportedCrypto.Gfi:
      return `${decimalFormatter.format(cryptoToFloat(cryptoAmount))}${
        includeSymbol ? " GFI" : ""
      }`;
    default:
      throw new Error(
        `Unrecognized crypto (${cryptoAmount.token}) in formatCrypto()`
      );
  }
}
