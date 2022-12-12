import { Resolvers } from "@apollo/client";
import { FixedNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { positionTypeToValue, sharesToUsdc } from "@/lib/pools";
import { getProvider } from "@/lib/wallet";

import { APY_DECIMALS, SECONDS_PER_YEAR } from "../../../constants";
import { StakedPositionType } from "../generated";

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
        positionTypeToValue[StakedPositionType.CurveLp]
      );
    const curveLPTokenMultiplier =
      await stakingRewardsContract.getEffectiveMultiplierForPositionType(
        positionTypeToValue[StakedPositionType.CurveLp]
      );
    const currentEarnRatePerYearPerFidu = (
      await stakingRewardsContract.currentEarnRatePerToken()
    ).mul(SECONDS_PER_YEAR);

    const currentEarnRatePerYearPerCurveToken = currentEarnRatePerYearPerFidu
      // Apply the exchange rate. The exchange rate is denominated in 1e18, so divide by 1e18 to keep the original denomination.
      .mul(curveLPTokenExchangeRate)
      .div(APY_DECIMALS)
      // Apply the multiplier. The multiplier is denominated in 1e18, so divide by 1e18 to keep the original denomination.
      .mul(curveLPTokenMultiplier)
      .div(APY_DECIMALS);

    return FixedNumber.from(currentEarnRatePerYearPerCurveToken).divUnsafe(
      FixedNumber.from(APY_DECIMALS)
    );
  },
  async usdcPerLpToken(): Promise<FixedNumber> {
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
    const curvePoolTotalUsdcValue = curvePoolUsdcBalance.add(
      sharesToUsdc(curvePoolFiduBalance, sharePrice).amount
    );

    const usdPerCurveLpToken = FixedNumber.from(
      curvePoolTotalUsdcValue
    ).divUnsafe(FixedNumber.from(curveLpTokenTotalSupply));
    return usdPerCurveLpToken;
  },
};
