import { utils } from "ethers";

import {
  USDC_DECIMALS,
  GFI_DECIMALS,
  FIDU_DECIMALS,
  CURVE_LP_DECIMALS,
} from "@/constants";

import {
  CryptoAmount,
  FiatAmount,
  SupportedCrypto,
} from "../graphql/generated";
import { assertUnreachable } from "../utils";

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
    case SupportedCrypto.CurveLp:
      const curveLpAsFloat = parseFloat(
        utils.formatUnits(cryptoAmount.amount, CURVE_LP_DECIMALS)
      );
      return curveLpAsFloat;
    default:
      assertUnreachable(cryptoAmount.token);
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
    includeSymbol: true,
    includeToken: false,
  };
  const { includeSymbol, includeToken } = { ...defaultOptions, ...options };
  const float = cryptoToFloat(cryptoAmount);
  const amount =
    float > 0 && float < 0.01 ? "<0.01" : decimalFormatter.format(float);
  const prefix =
    cryptoAmount.token === SupportedCrypto.Usdc && includeSymbol ? "$" : "";
  const suffix = includeToken ? ` ${tokenMap[cryptoAmount.token]}` : "";
  return prefix.concat(amount).concat(suffix);
}

const tokenMap: Record<SupportedCrypto, string> = {
  [SupportedCrypto.Usdc]: "USDC",
  [SupportedCrypto.Gfi]: "GFI",
  [SupportedCrypto.Fidu]: "FIDU",
  [SupportedCrypto.CurveLp]: "FIDU-USDC-F",
};
