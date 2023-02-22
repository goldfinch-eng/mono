import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  // Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { ContentType } from "recharts/types/component/DefaultLegendContent";

import { cryptoToFloat } from "@/lib/format";

import { RepaymentScheduleData } from "../v2-components/repayment-terms-schedule";

const MAX_X_AXIS_TICKS_BEFORE_LABEL_OVERFLOW = 40;
const Y_AXIS_ROUNDING_INTERVAL = 100000;

interface RepaymentScheduleBarChartLegendProps {
  className?: string;
  repaymentScheduleData: RepaymentScheduleData[];
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

const RepaymentScheduleBarChart = ({
  className,
  repaymentScheduleData,
}: RepaymentScheduleBarChartLegendProps) => {
  const repaymentScheduleDataFloat = repaymentScheduleData.map((data) => ({
    ...data,
    interest: cryptoToFloat({ amount: data.interest, token: "USDC" }),
    principal: cryptoToFloat({ amount: data.principal, token: "USDC" }),
  }));

  const maxYValue = cryptoToFloat({
    amount: repaymentScheduleData[
      repaymentScheduleData.length - 1
    ].principal.add(
      repaymentScheduleData[repaymentScheduleData.length - 1].interest
    ),
    token: "USDC",
  });

  const yAxisTicks = [
    0,
    maxYValue / 4,
    maxYValue / 2,
    (3 * maxYValue) / 4,
    // We don't want the tip of the final bar touching the top - add a bit of padding i.e 2% of the max
    maxYValue + maxYValue * 0.02,
  ].map((tick) =>
    tick > Y_AXIS_ROUNDING_INTERVAL
      ? Math.round(tick / Y_AXIS_ROUNDING_INTERVAL) * Y_AXIS_ROUNDING_INTERVAL
      : Math.trunc(tick)
  );

  return (
    <ResponsiveContainer width="100%" height={225} className={className}>
      <BarChart
        data={repaymentScheduleDataFloat}
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
          interval={
            repaymentScheduleDataFloat.length <=
            MAX_X_AXIS_TICKS_BEFORE_LABEL_OVERFLOW
              ? 0
              : 1
          }
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: "8px", dx: -30, dy: -8, textAnchor: "start" }}
          domain={[0, maxYValue]}
          ticks={yAxisTicks}
          tickCount={5}
          width={40}
        />
        <CartesianGrid vertical={false} x={0} width={650} />
        {/* TODO: Confirm with Chico - do we want a tooltip? */}
        {/* <Tooltip /> */}
        <Bar dataKey="principal" stackId="a" fill="#3D755B" />
        <Bar dataKey="interest" stackId="a" fill="#65C397" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RepaymentScheduleBarChart;
