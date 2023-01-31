import { Resolvers } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { CURVE_LP_MANTISSA, USDC_MANTISSA } from "@/constants";
import { getContract } from "@/lib/contracts";
import { positionTypeToValue, sharesToUsdc } from "@/lib/pools";
import { getProvider } from "@/lib/wallet";

const oneYearSeconds = BigNumber.from(60 * 60 * 24 * 365);
const apyDecimals = BigNumber.from("1000000000000000000"); // 1e18

async function getUsdPerLpToken() {
  // Using this helpful article to calculate the fiat value of Curve LP tokens: https://medium.com/coinmonks/the-joys-of-valuing-curve-lp-tokens-4e4a148eaeb9
  // This calculation also assumes that 1 USDC = 1 USD

  const provider = await getProvider();
  const curvePoolContract = await getContract({
    name: "CurvePool",
    provider,
  });
  const curveLpTokenContract = await getContract({
    name: "CurveLP",
    provider,
  });
  const curveLpTokenTotalSupply = await curveLpTokenContract.totalSupply();
  const fixedCurveLpTokenTotalSupply = FixedNumber.from(
    curveLpTokenTotalSupply
  ).divUnsafe(FixedNumber.from(CURVE_LP_MANTISSA));
  const fiduContract = await getContract({ name: "Fidu", provider });
  const usdcContract = await getContract({ name: "USDC", provider });
  const seniorPoolContract = await getContract({
    name: "SeniorPool",
    provider,
  });
  const sharePrice = await seniorPoolContract.sharePrice();

  const curvePoolFiduBalance = await fiduContract.balanceOf(
    curvePoolContract.address
  );
  const curvePoolUsdcBalance = await usdcContract.balanceOf(
    curvePoolContract.address
  );
  const curvePoolTotalUsdValue = curvePoolUsdcBalance
    .add(sharesToUsdc(curvePoolFiduBalance, sharePrice).amount)
    .div(USDC_MANTISSA);

  const usdPerCurveLpToken = FixedNumber.from(curvePoolTotalUsdValue).divUnsafe(
    fixedCurveLpTokenTotalSupply
  );
  return usdPerCurveLpToken;
}

export const curvePoolResolvers: Resolvers[string] = {
  async estimatedCurveStakingApyRaw(): Promise<FixedNumber> {
    const provider = await getProvider();
    if (!provider) {
      throw new Error(
        "No provider available when resolving curveLPTokenExchangeRate"
      );
    }
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
      provider,
    });

    const curveLPTokenExchangeRate =
      await stakingRewardsContract.getBaseTokenExchangeRate(
        positionTypeToValue["CurveLP"]
      );
    const curveLPTokenMultiplier =
      await stakingRewardsContract.getEffectiveMultiplierForPositionType(
        positionTypeToValue["CurveLP"]
      );
    const currentEarnRatePerYearPerFidu = (
      await stakingRewardsContract.currentEarnRatePerToken()
    ).mul(oneYearSeconds);

    const currentEarnRatePerYearPerCurveToken = currentEarnRatePerYearPerFidu
      // Apply the exchange rate. The exchange rate is denominated in 1e18, so divide by 1e18 to keep the original denomination.
      .mul(curveLPTokenExchangeRate)
      .div(apyDecimals)
      // Apply the multiplier. The multiplier is denominated in 1e18, so divide by 1e18 to keep the original denomination.
      .mul(curveLPTokenMultiplier)
      .div(apyDecimals);

    const usdCostPerLpToken = await getUsdPerLpToken();

    return FixedNumber.from(currentEarnRatePerYearPerCurveToken)
      .divUnsafe(FixedNumber.from(apyDecimals))
      .divUnsafe(usdCostPerLpToken);
  },
  async usdPerLpToken(): Promise<FixedNumber> {
    return getUsdPerLpToken();
  },
};
