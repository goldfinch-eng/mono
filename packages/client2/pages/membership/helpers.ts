import { BigNumber } from "ethers";

import type { Asset } from "@/components/design-system";
import {
  PoolTokenFieldsForAssetsFragment,
  StakedPositionFieldsForAssetsFragment,
} from "@/lib/graphql/generated";
import { sharesToUsdc } from "@/lib/pools";

export function convertPoolTokenToAsset(
  poolToken: PoolTokenFieldsForAssetsFragment
): Asset {
  return {
    name: `Borrower Pool Position (Token #${poolToken.id})`,
    description: poolToken.loan.name,
    usdcAmount: {
      token: "USDC",
      amount: poolToken.principalAmount.sub(poolToken.principalRedeemed),
    },
  };
}

export function convertStakedPositionToAsset(
  stakedPosition: StakedPositionFieldsForAssetsFragment,
  sharePrice: BigNumber
): Asset {
  return {
    name: `Staked Fidu (Token #${stakedPosition.id})`,
    description: "Goldfinch Senior Pool Position",
    nativeAmount: {
      token: "FIDU",
      amount: stakedPosition.amount,
    },
    usdcAmount: sharesToUsdc(stakedPosition.amount, sharePrice),
  };
}
