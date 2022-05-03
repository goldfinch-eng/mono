import { BigNumber, FixedNumber, utils } from "ethers";

import { USDC_DECIMALS } from "@/constants";

// Intl formatters are nice because they are sensitive to the user's device locale. For now they are hard-coded to en-US, but in the future this can be parameterized or even changed into hooks (to get locale from context)

const percentageFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const doubleDigitFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatPercent(n: number | FixedNumber) {
  if (n instanceof FixedNumber) {
    return percentageFormatter.format(n.toUnsafeFloat());
  }
  return percentageFormatter.format(n);
}

/**
 *
 * @param usdc Raw amount of USDC (atomic form, exactly as it is returned from its contract)
 * @returns USDC divided by the amount of USDC decimal places. For use in displaying a USDC balance.
 */
export function usdcFromAtomic(usdc: BigNumber) {
  const asFloat = parseFloat(utils.formatUnits(usdc, USDC_DECIMALS));
  return `${doubleDigitFormatter.format(asFloat)}`;
}

/**
 *
 * @param usdc Raw amount of USDC (atomic form)
 * @returns Amount formatted as a string for display in the UI. Also includes the dollar sign and currency code
 */
export function formatUsdcAsDollars(usdc: BigNumber) {
  const asFloat = parseFloat(utils.formatUnits(usdc, USDC_DECIMALS));
  return `$${doubleDigitFormatter.format(asFloat)} USD`;
}

export function formatDollarAmount(n: number) {
  return `$${doubleDigitFormatter.format(n)}`;
}

export * from "./currency-units";
