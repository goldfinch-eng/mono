import { gql } from "@apollo/client";
import clsx from "clsx";
import { format as formatDate } from "date-fns";
import { BigNumber, utils } from "ethers";
import { ReactNode, useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";

import { Icon, InfoIconTooltip, Shimmer } from "@/components/design-system";
import { FIDU_DECIMALS } from "@/constants";
import { formatCrypto } from "@/lib/format";
import {
  ChartDisbursementFieldsFragment,
  CryptoAmount,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { epochFinalizedDate } from "@/lib/membership";
import { sharesToUsdc, sum } from "@/lib/pools";

export const CHART_DISBURSEMENT_FIELDS = gql`
  fragment ChartDisbursementFields on MembershipRewardDisbursement {
    id
    allocatedAt
    rewards
    epoch
  }
`;

interface YourRewardsProps {
  className?: string;
  disbursements: ChartDisbursementFieldsFragment[];
  currentBlockTimestamp: number;
  sharePrice: BigNumber;
  accruedThisEpoch: CryptoAmount;
  showNextEpochNotice?: boolean;
}

interface Payload {
  timestamp: number;
  amount: number | null;
  cryptoAmount: CryptoAmount;
  projectedAmount: number | null; // the use of `projectedAmount` is just a cheap trick to enable part of the chart to be a solid line while another part is a dashed line
  isProjection?: boolean;
}

export function YourRewards({
  className,
  disbursements,
  currentBlockTimestamp,
  sharePrice,
  accruedThisEpoch,
  showNextEpochNotice = false,
}: YourRewardsProps) {
  const currentEpochFinalizedDate = epochFinalizedDate(
    currentBlockTimestamp * 1000
  );
  const data: Payload[] = useMemo(() => {
    const d: Payload[] = disbursements.map((disbursement, index) => ({
      timestamp: disbursement.allocatedAt * 1000,
      amount: fiduBigNumberToFloat(
        sum("rewards", disbursements.slice(0, index + 1))
      ),
      cryptoAmount: {
        token: SupportedCrypto.Fidu,
        amount: sum("rewards", disbursements.slice(0, index + 1)),
      },
      projectedAmount: null,
    }));

    const lastFinalizedData = d.slice(-1)[0];
    if (lastFinalizedData) {
      d.push(
        {
          timestamp: lastFinalizedData.timestamp,
          amount: null,
          cryptoAmount: lastFinalizedData.cryptoAmount,
          projectedAmount: lastFinalizedData.amount,
        },
        {
          timestamp: currentEpochFinalizedDate.getTime(),
          amount: null,
          cryptoAmount: {
            token: SupportedCrypto.Fidu,
            amount: lastFinalizedData.cryptoAmount.amount.add(
              accruedThisEpoch.amount
            ),
          },
          projectedAmount:
            (lastFinalizedData.amount as number) +
            fiduBigNumberToFloat(accruedThisEpoch.amount),
          isProjection: true,
        }
      );
    }

    return d;
  }, [disbursements, currentEpochFinalizedDate, accruedThisEpoch]);
  return (
    <div className={className}>
      <h2 className="mb-10 text-4xl">Your Member Rewards</h2>
      <WrapperGrid>
        {disbursements.length >= 2 ? (
          <GridItem className="col-span-full">
            <ResponsiveContainer width="100%" aspect={2.5}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#84CFAC" stopOpacity={1} />
                    <stop offset="100%" stopColor="#84CFAC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="stepAfter"
                  dataKey="amount"
                  stroke="#84CFAC"
                  strokeWidth="4"
                  fill="url(#areaGradient)"
                />
                <Area
                  type="stepAfter"
                  dataKey="projectedAmount"
                  stroke="#84CFAC"
                  strokeLinecap="round"
                  strokeDasharray={10}
                  strokeWidth="4"
                  fill="url(#areaGradient)"
                />
                <XAxis
                  dataKey="timestamp"
                  scale="time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(timestamp) => formatDate(timestamp, "MM/yy")}
                  tickMargin={8}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
              </AreaChart>
            </ResponsiveContainer>
          </GridItem>
        ) : null}
        <GridItem>
          <Stat
            heading="Total Member Rewards distributed to date"
            icon={<div className="h-2 w-2 rounded-full bg-mint-450" />}
            tooltip="The total value of Member Rewards distributed to your address since you became a Member."
            left={formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: sharesToUsdc(sum("rewards", disbursements), sharePrice)
                .amount,
            })}
            right={formatCrypto({
              token: SupportedCrypto.Fidu,
              amount: sum("rewards", disbursements),
            })}
          />
        </GridItem>
        <GridItem>
          <Stat
            heading="Member rewards accrued this week"
            icon={<DoubleDotIcon />}
            tooltip="The total value of Member Rewards distributed to your address since you became a Member."
            left={formatCrypto(
              sharesToUsdc(accruedThisEpoch.amount, sharePrice)
            )}
            right={formatCrypto(accruedThisEpoch)}
          />
        </GridItem>
        <GridItem>
          <Stat
            heading="Next Member Reward distribution"
            tooltip="The date of the next Member Reward distribution. Withdrawing your Capital from the Member Vault before this date will forfeit your rewards for this weekly cycle."
            left={formatDate(currentEpochFinalizedDate, "MMMM dd, yyyy")}
          />
        </GridItem>
      </WrapperGrid>
      {showNextEpochNotice ? (
        <div className="mt-2 flex items-center rounded-lg border-2 border-mustard-100 bg-mustard-50 p-5">
          <Icon
            name="ExclamationCircleSolid"
            className="mr-2 text-mustard-450"
            size="sm"
          />
          <div className="text-sm">
            The assets you added to the Vault will take effect during the Member
            Rewards Cycle beginning on{" "}
            {formatDate(currentEpochFinalizedDate, "MMMM dd, yyyy")}.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WrapperGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-px overflow-hidden rounded-lg border border-sand-200 bg-sand-200 md:grid-cols-3">
      {children}
    </div>
  );
}

function GridItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={clsx("bg-white p-8", className)}>{children}</div>;
}

function Stat({
  heading,
  icon,
  tooltip,
  left,
  right,
  isPlaceholder = false,
}: {
  heading: string;
  icon?: ReactNode;
  tooltip?: string;
  left?: string;
  right?: string;
  isPlaceholder?: boolean;
}) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="mb-3 flex items-center text-sm text-sand-600">
        {icon ? <div className="mr-2.5">{icon}</div> : null}
        {heading}
        {tooltip ? (
          <InfoIconTooltip className="ml-2.5" content={tooltip} />
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        {isPlaceholder ? (
          <Shimmer style={{ width: "16ch" }} />
        ) : (
          <>
            <div className="text-lg font-medium">{left}</div>
            {right ? (
              <div className="text-sm text-sand-400">{right}</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function fiduBigNumberToFloat(fidu: BigNumber): number {
  return parseFloat(utils.formatUnits(fidu, FIDU_DECIMALS));
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Payload }[];
}) {
  if (
    active &&
    payload &&
    payload.length > 0 &&
    payload[0].payload.cryptoAmount !== null
  ) {
    return (
      <div className="rounded border border-sand-200 bg-white p-3 text-sm">
        <div className="font-medium">
          {formatDate(payload[0].payload.timestamp, "MMMM dd, yyyy")}
        </div>
        <div className="text-sand-500">
          {formatCrypto(payload[0].payload.cryptoAmount)}
          {payload[0].payload.isProjection ? " (Projected)" : null}
        </div>
      </div>
    );
  }
  return null;
}

export function YourRewardsPlaceholder({ className }: { className?: string }) {
  return (
    <div className={className}>
      <h2 className="mb-10 text-4xl">Your Member Rewards</h2>
      <WrapperGrid>
        <GridItem className="col-span-full">
          <div style={{ width: "100%", aspectRatio: "2.5" }} />
        </GridItem>
        <GridItem>
          <Stat
            heading="Total Member Rewards distributed to date"
            icon={<div className="h-2 w-2 rounded-full bg-mint-450" />}
            tooltip="The total value of Member Rewards distributed to your address since you became a Member."
            isPlaceholder
          />
        </GridItem>
        <GridItem>
          <Stat
            heading="Member rewards accrued this week"
            icon={<DoubleDotIcon />}
            tooltip="The total value of Member Rewards distributed to your address since you became a Member."
            isPlaceholder
          />
        </GridItem>
        <GridItem>
          <Stat
            heading="Next Member Reward distribution"
            tooltip="The date of the next Member Reward distribution. Withdrawing your Capital from the Member Vault before this date will forfeit your rewards for this weekly cycle."
            isPlaceholder
          />
        </GridItem>
      </WrapperGrid>
    </div>
  );
}

function DoubleDotIcon() {
  return (
    <div className="relative">
      <div className="absolute left-0 bottom-0 h-1 w-1 rounded-full bg-mint-450" />
      <div className="absolute right-0 top-0 h-1 w-1 rounded-full bg-mint-450" />
    </div>
  );
}
