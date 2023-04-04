import { Resolvers } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { CURVE_LP_MANTISSA, USDC_MANTISSA } from "@/constants";
import { getContract2 } from "@/lib/contracts";
import { positionTypeToValue, sharesToUsdc } from "@/lib/pools";

const oneYearSeconds = BigNumber.from(60 * 60 * 24 * 365);
const apyDecimals = BigNumber.from("1000000000000000000"); // 1e18

async function getUsdPerLpToken() {
  // Using this helpful article to calculate the fiat value of Curve LP tokens: https://medium.com/coinmonks/the-joys-of-valuing-curve-lp-tokens-4e4a148eaeb9
  // This calculation also assumes that 1 USDC = 1 USD

  const curvePoolContract = await getContract2({ name: "CurvePool" });
  const curveLpTokenContract = await getContract2({ name: "CurveLP" });
  const curveLpTokenTotalSupply = await curveLpTokenContract.totalSupply();
  const fixedCurveLpTokenTotalSupply = FixedNumber.from(
    curveLpTokenTotalSupply
  ).divUnsafe(FixedNumber.from(CURVE_LP_MANTISSA));
  const fiduContract = await getContract2({ name: "Fidu" });
  const usdcContract = await getContract2({ name: "USDC" });
  const seniorPoolContract = await getContract2({ name: "SeniorPool" });
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
    const stakingRewardsContract = await getContract2({
      name: "StakingRewards",
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
    const apy = usdCostPerLpToken.isZero()
      ? FixedNumber.fromString("0")
      : FixedNumber.from(currentEarnRatePerYearPerCurveToken)
          .divUnsafe(FixedNumber.from(apyDecimals))
          .divUnsafe(usdCostPerLpToken);

    return apy;
  },
  async usdPerLpToken(): Promise<FixedNumber> {
    return getUsdPerLpToken();
  },
};
