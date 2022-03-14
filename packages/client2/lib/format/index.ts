import { BigNumber, FixedNumber } from "ethers";

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

const dollarFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  currencyDisplay: "symbol",
});

export function formatUsdc(n: BigNumber | number) {
  const usdcDivisor = 10 ** USDC_DECIMALS;
  if (n instanceof BigNumber) {
    return dollarFormatter.format(n.div(usdcDivisor).toNumber());
  }
  return dollarFormatter.format(n / usdcDivisor);
}
