import { gql } from "@apollo/client";
import clsx from "clsx";
import { format } from "date-fns";
import { utils } from "ethers";
import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";

import { FIDU_DECIMALS } from "@/constants";
import { formatCrypto } from "@/lib/format";
import {
  ChartDisbursementFieldsFragment,
  CryptoAmount,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { sum } from "@/lib/pools";

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
}

interface Payload {
  timestamp: number;
  amount: number;
  cryptoAmount: CryptoAmount;
}

export function YourRewards({ className, disbursements }: YourRewardsProps) {
  const data: Payload[] = useMemo(() => {
    return disbursements.map((disbursement, index) => ({
      timestamp: disbursement.allocatedAt * 1000,
      amount: parseFloat(
        utils.formatUnits(
          sum("rewards", disbursements.slice(0, index + 1)),
          FIDU_DECIMALS
        )
      ),
      cryptoAmount: {
        token: SupportedCrypto.Fidu,
        amount: sum("rewards", disbursements.slice(0, index + 1)),
      },
    }));
  }, [disbursements]);
  return (
    <div className={clsx("rounded-lg border border-sand-200 p-8", className)}>
      <h2 className="mb-10 text-4xl">Your Member Rewards</h2>
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
          <XAxis
            dataKey="timestamp"
            scale="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(timestamp) => format(timestamp, "MM/yy")}
            tickMargin={8}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Payload }[];
}) {
  if (active && payload && payload.length > 0) {
    return (
      <div className="rounded border border-sand-200 bg-white p-3 text-sm">
        <div className="font-medium">
          {format(payload[0].payload.timestamp, "MMMM dd, yyyy")}
        </div>
        <div className="text-sand-500">
          {formatCrypto(payload[0].payload.cryptoAmount)}
        </div>
      </div>
    );
  }
  return null;
}
