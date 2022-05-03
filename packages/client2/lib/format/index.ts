import { FixedNumber } from "ethers";

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
 * @deprecated Use formatFiat() instead of this please
 */
export function formatDollarAmount(n: number) {
  return `$${doubleDigitFormatter.format(n)}`;
}

export * from "./currency-units";
