import { BigNumber } from "ethers";

import type { Asset } from "@/components/design-system";
import {
  PoolTokenFieldsForAssetsFragment,
  SupportedCrypto,
  StakedPositionFieldsForAssetsFragment,
} from "@/lib/graphql/generated";
import { sharesToUsdc } from "@/lib/pools";

export function convertPoolTokenToAsset(
  poolToken: PoolTokenFieldsForAssetsFragment
): Asset {
  return {
    name: `Borrower Pool Position (Token #${poolToken.id})`,
    description: poolToken.tranchedPool.name,
    usdcAmount: {
      token: SupportedCrypto.Usdc,
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
      token: SupportedCrypto.Fidu,
      amount: stakedPosition.amount,
    },
    usdcAmount: sharesToUsdc(stakedPosition.amount, sharePrice),
  };
}
