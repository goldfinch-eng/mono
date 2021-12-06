import BigNumber from "bignumber.js"

export const toDisplayPercent = (val: BigNumber): string => `${val.multipliedBy(100).decimalPlaces(2).toString()}%`
