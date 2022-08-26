import { Tab } from "@headlessui/react";
import { BigNumber } from "ethers";

import { Paragraph } from "@/components/design-system";
import { StakedPositionType, CryptoAmount } from "@/lib/graphql/generated";

import type { SimpleStakedPosition } from "./index.page";
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
  positions: SimpleStakedPosition[];
  usdcBalance: CryptoAmount;
  sharePrice: BigNumber;
  onComplete: () => void;
}

export default function StakeOnGoldfinch({
  fiduBalance,
  fiduStaked,
  curveBalance,
  curveStaked,
  positions,
  usdcBalance,
  sharePrice,
  onComplete,
}: StakeOnGoldfinchProps) {
  const fiduPositions = positions.filter(
    (pos) =>
      pos.positionType === StakedPositionType.Fidu &&
      pos.amount.gt(BigNumber.from(0))
  );

  const curvePositions = positions.filter(
    (pos) =>
      pos.positionType === StakedPositionType.CurveLp &&
      pos.amount.gt(BigNumber.from(0))
  );

  return (
    <>
      <div className="mb-3">
        <StakeCardCollapse
          heading="FIDU"
          subheading="Goldfinch Token"
          staked={fiduStaked}
          available={fiduBalance}
          apy={0}
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
          apy={0}
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
