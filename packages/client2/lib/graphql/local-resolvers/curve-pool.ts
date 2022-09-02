import { Resolvers } from "@apollo/client";
import { BigNumber, FixedNumber } from "ethers";

import { getContract } from "@/lib/contracts";
import { positionTypeToValue } from "@/lib/pools";
import { getProvider } from "@/lib/wallet";

import { StakedPositionType } from "../generated";

const oneYearSeconds = BigNumber.from(60 * 60 * 24 * 365);
const apyDecimals = BigNumber.from("1000000000000000000"); // 1e18

export const curvePoolResolvers: Resolvers[string] = {
  async estimatedCurveStakingApyRaw(): Promise<FixedNumber> {
    const provider = await getProvider();
    if (!provider) {
      throw new Error(
        "No provider available when resolving curveLPTokenExchangeRate"
      );
    }
    const chainId = await provider.getSigner().getChainId();
    const stakingRewardsContract = getContract({
      name: "StakingRewards",
      chainId,
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
    ).mul(oneYearSeconds);

    const currentEarnRatePerYearPerCurveToken = currentEarnRatePerYearPerFidu
      // Apply the exchange rate. The exchange rate is denominated in 1e18, so divide by 1e18 to keep the original denomination.
      .mul(curveLPTokenExchangeRate)
      .div(apyDecimals)
      // Apply the multiplier. The multiplier is denominated in 1e18, so divide by 1e18 to keep the original denomination.
      .mul(curveLPTokenMultiplier)
      .div(apyDecimals);

    return FixedNumber.from(currentEarnRatePerYearPerCurveToken).divUnsafe(
      FixedNumber.from(apyDecimals)
    );
  },
};
