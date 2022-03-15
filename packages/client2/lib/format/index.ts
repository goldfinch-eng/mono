import { BigNumber, FixedNumber, utils } from "ethers";

import { USDC_DECIMALS } from "@/constants";

const percentageFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPercent(n: number | FixedNumber) {
  if (n instanceof FixedNumber) {
    return percentageFormatter.format(n.toUnsafeFloat());
  }
  return percentageFormatter.format(n);
}

export function formatUsdc(n: BigNumber) {
  return `$${utils.commify(utils.formatUnits(n, USDC_DECIMALS))}`;
}
