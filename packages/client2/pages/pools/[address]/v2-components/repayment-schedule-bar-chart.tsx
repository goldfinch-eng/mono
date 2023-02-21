import { BigNumber } from "ethers/lib/ethers";
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
} from "recharts";
import type { ContentType } from "recharts/types/component/DefaultLegendContent";

import { cryptoToFloat } from "@/lib/format";

import { RepaymentScheduleData } from "../v2-components/repayment-terms-schedule";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  notation: "compact",
  style: "currency",
  currency: "USD",
});

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
  return (
    <ResponsiveContainer width="100%" height={300} className={className}>
      <BarChart
        data={repaymentScheduleData}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <Legend
          content={RepaymentScheduleBarChartLegend}
          align="right"
          verticalAlign="top"
          wrapperStyle={{ paddingBottom: 32 }}
        />
        <XAxis dataKey="paymentPeriod" tick={{ fontSize: "10px" }} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickCount={5}
          tickFormatter={(value: BigNumber) =>
            numberFormatter.format(
              cryptoToFloat({ amount: value, token: "USDC" })
            )
          }
          tick={{ fontSize: "10px", dx: -50, dy: -8, textAnchor: "start" }}
        />
        <CartesianGrid vertical={false} x={0} width={650} />
        <Tooltip
          formatter={(value) =>
            numberFormatter.format(
              cryptoToFloat({
                // 'ValueType' parameter for Recharts expects a number or string but we're using BigNumbers
                amount: value as unknown as BigNumber,
                token: "USDC",
              })
            )
          }
        />
        <Bar dataKey="principal" stackId="a" fill="#564928" />
        <Bar dataKey="interest" stackId="a" fill="#D7BD7A" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RepaymentScheduleBarChart;
