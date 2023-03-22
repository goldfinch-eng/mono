import { BigNumber, FixedNumber } from "ethers";

// Intl formatters are nice because they are sensitive to the user's device locale. For now they are hard-coded to en-US, but in the future this can be parameterized or even changed into hooks (to get locale from context)

const percentageFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPercent(n: number | FixedNumber) {
  const nAsFloat = n instanceof FixedNumber ? n.toUnsafeFloat() : n;
  if (n > 0 && n < 0.01) {
    return "<0.01%";
  }
  return percentageFormatter.format(nAsFloat);
}

export function computePercentage(n: BigNumber, total: BigNumber): number {
  if (total.isZero()) {
    return 0;
  }
  return FixedNumber.from(n).divUnsafe(FixedNumber.from(total)).toUnsafeFloat();
}

export * from "./currency-units";
