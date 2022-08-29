import { Tab } from "@headlessui/react";
import { BigNumber, FixedNumber } from "ethers";

import { Paragraph } from "@/components/design-system";
import {
  StakedPositionType,
  CryptoAmount,
  StakeFormPositionFieldsFragment,
} from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";

import StakeCardCollapse from "./stake-card-collapse";
import StakeCardForm from "./stake-card-form";
import {
  StakeTabGroup,
  StakeTabContent,
  StakeTabButton,
} from "./stake-card-tabs";
import StakeMigrateForm from "./stake-migrate-form";

interface StakeOnGoldfinchProps {
  fiduBalance: CryptoAmount;
  fiduStaked: CryptoAmount;
  curveBalance: CryptoAmount;
  curveStaked: CryptoAmount;
  fiduPositions: StakeFormPositionFieldsFragment[];
  curvePositions: StakeFormPositionFieldsFragment[];
  usdcBalance: CryptoAmount;
  sharePrice: BigNumber;
  gfiApi: FixedNumber;
  gfiPrice: number;
  onComplete: () => void;
}

export default function StakeOnGoldfinch({
  fiduBalance,
  fiduStaked,
  curveBalance,
  curveStaked,
  usdcBalance,
  sharePrice,
  fiduPositions,
  curvePositions,
  gfiApi,
  gfiPrice,
  onComplete,
}: StakeOnGoldfinchProps) {
  return (
    <>
      <div className="mb-3 grid grid-cols-12 items-center px-6 text-sand-500">
        <div className="col-span-5">Token to stake</div>
        <div className="col-span-2 text-right">Est. APY</div>
        <div className="col-span-2 text-right">Available to stake</div>
        <div className="col-span-2 text-right">Staked</div>
      </div>

      <div className="mb-3">
        <StakeCardCollapse
          heading="FIDU"
          subheading="Goldfinch Token"
          staked={fiduStaked}
          available={fiduBalance}
          apy={computeApyFromGfiInFiat(gfiApi, gfiPrice)}
        >
          <StakeTabGroup>
            <Tab.List>
              <StakeTabButton>Stake</StakeTabButton>
              <StakeTabButton>Unstake</StakeTabButton>
              <StakeTabButton>Migrate</StakeTabButton>
            </Tab.List>
            <Tab.Panels>
              <StakeTabContent>
                <StakeCardForm
                  action="STAKE"
                  balance={fiduBalance}
                  positions={fiduPositions}
                  positionType={StakedPositionType.Fidu}
                  onComplete={onComplete}
                />
              </StakeTabContent>
              <StakeTabContent>
                <StakeCardForm
                  action="UNSTAKE"
                  balance={fiduStaked}
                  positions={fiduPositions}
                  positionType={StakedPositionType.Fidu}
                  onComplete={onComplete}
                />
              </StakeTabContent>
              <StakeTabContent>
                <Paragraph className="mb-6">
                  Migrate your staked FIDU to deposit it in the Curve FIDU-USDC
                  liquidity pool, without needing to unstake it on Goldfinch.
                </Paragraph>
                <StakeMigrateForm
                  fiduStaked={fiduStaked}
                  usdcBalance={usdcBalance}
                  positions={fiduPositions}
                  sharePrice={sharePrice}
                  onComplete={onComplete}
                />
              </StakeTabContent>
            </Tab.Panels>
          </StakeTabGroup>
        </StakeCardCollapse>
      </div>

      <div>
        <StakeCardCollapse
          heading="FIDU-USDC-F"
          subheading="Curve LP token"
          staked={curveStaked}
          available={curveBalance}
          apy={FixedNumber.from(0)}
        >
          <StakeTabGroup>
            <Tab.List>
              <StakeTabButton>Stake</StakeTabButton>
              <StakeTabButton>Unstake</StakeTabButton>
            </Tab.List>
            <Tab.Panels>
              <StakeTabContent>
                <StakeCardForm
                  action="STAKE"
                  balance={curveBalance}
                  positions={curvePositions}
                  positionType={StakedPositionType.CurveLp}
                  tokenMask="FIDU-USDC-F"
                  onComplete={onComplete}
                />
              </StakeTabContent>
              <StakeTabContent>
                <StakeCardForm
                  action="UNSTAKE"
                  balance={curveStaked}
                  positions={curvePositions}
                  positionType={StakedPositionType.CurveLp}
                  tokenMask="FIDU-USDC-F"
                  onComplete={onComplete}
                />
              </StakeTabContent>
            </Tab.Panels>
          </StakeTabGroup>
        </StakeCardCollapse>
      </div>
    </>
  );
}
