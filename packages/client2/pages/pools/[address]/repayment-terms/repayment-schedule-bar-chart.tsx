import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import type { ContentType } from "recharts/types/component/DefaultLegendContent";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { AxisInterval } from "recharts/types/util/types";

import { cryptoToFloat, formatFiat } from "@/lib/format";
import { RepaymentSchedule } from "@/lib/pools";

const Y_AXIS_ROUNDING_INTERVAL = 100000;
const tickFormatter = new Intl.NumberFormat("en-US");

interface RepaymentScheduleBarChartProps {
  className?: string;
  repaymentSchedule: RepaymentSchedule;
}

const RepaymentScheduleBarChartLegend: ContentType = ({ payload }) => (
  <div className="flex justify-between">
    <div className="text-sm font-normal text-sand-600">Repayment schedule</div>
    <div className="flex">
      {payload?.map(({ value, color }) => (
        <div key={value} className="ml-4 flex items-center">
          <svg className="mr-2 h-1.5 w-1.5">
            <circle cx={3} cy={3} r={3} fill={color} />
          </svg>
          <div className="text-xs capitalize text-sand-500">{value}</div>
        </div>
      ))}
    </div>
  </div>
);

const RepaymentScheduleBarChartTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (active && payload) {
    const principalDataPoint = payload[0];
    const interestDataPoint = payload[1];

    return (
      <div className="rounded-lg bg-white p-2 text-xs shadow-lg outline-none">
        <div className="mb-1">Month {label}</div>
        <div className="mb-1 flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: principalDataPoint.color }}
          />
          <div>
            {`Principal: ${formatFiat({
              amount: principalDataPoint.payload.principal,
              symbol: "USD",
            })}`}
          </div>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: interestDataPoint.color }}
          />
          <div>
            {`Interest: ${formatFiat({
              amount: interestDataPoint.payload.interest,
              symbol: "USD",
            })}`}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export function RepaymentScheduleBarChart({
  className,
  repaymentSchedule,
}: RepaymentScheduleBarChartProps) {
  const repaymentScheduleFloat = repaymentSchedule.map((data) => ({
    ...data,
    interest: cryptoToFloat({ amount: data.interest, token: "USDC" }),
    principal: cryptoToFloat({ amount: data.principal, token: "USDC" }),
  }));

  const maxYValue =
    repaymentScheduleFloat[repaymentScheduleFloat.length - 1].principal +
    repaymentScheduleFloat[repaymentScheduleFloat.length - 1].interest;

  const yAxisTicks = [
    0,
    maxYValue / 4,
    maxYValue / 2,
    (3 * maxYValue) / 4,
    // Add a bit to the max Y domain i.e 2% of the max
    maxYValue + maxYValue * 0.02,
  ].map((yAxisTick) =>
    yAxisTick > Y_AXIS_ROUNDING_INTERVAL
      ? Math.round(yAxisTick / Y_AXIS_ROUNDING_INTERVAL) *
        Y_AXIS_ROUNDING_INTERVAL
      : Math.trunc(yAxisTick)
  );

  return (
    <ResponsiveContainer width="100%" height={225} className={className}>
      <BarChart
        data={repaymentScheduleFloat}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <Legend
          content={RepaymentScheduleBarChartLegend}
          align="right"
          verticalAlign="top"
          wrapperStyle={{ paddingBottom: 32 }}
        />
        <XAxis
          dataKey="paymentPeriod"
          tick={{ fontSize: "8px" }}
          interval={"equidistantPreserveStart" as AxisInterval | undefined}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: "8px", dx: -30, dy: -8, textAnchor: "start" }}
          domain={[0, maxYValue]}
          ticks={yAxisTicks}
          tickCount={5}
          tickFormatter={(value) => tickFormatter.format(value)}
          width={40}
        />
        <CartesianGrid vertical={false} x={0} width={650} />
        <Tooltip
          content={RepaymentScheduleBarChartTooltip}
          offset={15}
          // This removes the purple outline applied to the currently active tooltip
          wrapperStyle={{ boxShadow: "none" }}
        />
        <Bar dataKey="principal" stackId="a" fill="#3D755B" />
        <Bar dataKey="interest" stackId="a" fill="#65C397" />
      </BarChart>
    </ResponsiveContainer>
  );
}
