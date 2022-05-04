import { BigNumber, FixedNumber, utils } from "ethers";

import { GFI_DECIMALS, USDC_DECIMALS } from "@/constants";

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

/**
 *
 * @param gfi Raw amount of GFI (atomic form, exactly as it is returned from its contract)
 * @returns GFI divided by the amount of GFI decimal places. For use in displaying a GFI balance.
 */
export function gfiFromAtomic(gfi: BigNumber) {
  const asFloat = parseFloat(utils.formatUnits(gfi, GFI_DECIMALS));
  return `${doubleDigitFormatter.format(asFloat)}`;
}

/**
 *
 * @param gfi Atomic GFI amount
 * @param usdPerGfi Price of gfi (in USD)
 * @returns GFI converted to dollars and formatted as a dollar amount
 */
export function formatGfiAsDollars(gfi: BigNumber, usdPerGfi: number) {
  const gfiAsFloat = parseFloat(utils.formatUnits(gfi, GFI_DECIMALS));
  return `$${doubleDigitFormatter.format(gfiAsFloat * usdPerGfi)} USD`;
}

export function formatDollarAmount(n: number) {
  return `$${doubleDigitFormatter.format(n)}`;
}
