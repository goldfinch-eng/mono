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

const data = [
  { paymentPeriod: "1", principal: 0, interest: 24000 },
  { paymentPeriod: "2", principal: 0, interest: 24000 },
  { paymentPeriod: "3", principal: 0, interest: 24000 },
  { paymentPeriod: "3", principal: 0, interest: 24000 },
  { paymentPeriod: "4", principal: 0, interest: 24000 },
  { paymentPeriod: "5", principal: 0, interest: 24000 },
  { paymentPeriod: "6", principal: 0, interest: 24000 },
  { paymentPeriod: "7", principal: 0, interest: 24000 },
  { paymentPeriod: "8", principal: 0, interest: 24000 },
  { paymentPeriod: "9", principal: 0, interest: 24000 },
  { paymentPeriod: "10", principal: 0, interest: 24000 },
  { paymentPeriod: "11", principal: 0, interest: 24000 },
  { paymentPeriod: "12", principal: 0, interest: 24000 },
  { paymentPeriod: "13", principal: 0, interest: 24000 },
  { paymentPeriod: "14", principal: 0, interest: 24000 },
  { paymentPeriod: "15", principal: 0, interest: 24000 },
  { paymentPeriod: "16", principal: 0, interest: 24000 },
  { paymentPeriod: "17", principal: 0, interest: 24000 },
  { paymentPeriod: "18", principal: 0, interest: 24000 },
  { paymentPeriod: "19", principal: 0, interest: 24000 },
  { paymentPeriod: "20", principal: 0, interest: 24000 },
  { paymentPeriod: "21", principal: 0, interest: 24000 },
  { paymentPeriod: "22", principal: 0, interest: 24000 },
  { paymentPeriod: "23", principal: 0, interest: 24000 },
  { paymentPeriod: "24", principal: 2130000, interest: 24000 },
  //   { paymentPeriod: "25", principal: 0, interest: 24000 },
  //   { paymentPeriod: "26", principal: 0, interest: 24000 },
  //   { paymentPeriod: "27", principal: 0, interest: 24000 },
  //   { paymentPeriod: "28", principal: 0, interest: 24000 },
  //   { paymentPeriod: "29", principal: 0, interest: 24000 },
  //   { paymentPeriod: "30", principal: 0, interest: 24000 },
  //   { paymentPeriod: "32", principal: 0, interest: 24000 },
  //   { paymentPeriod: "33", principal: 0, interest: 24000 },
  //   { paymentPeriod: "34", principal: 0, interest: 24000 },
  //   { paymentPeriod: "35", principal: 0, interest: 24000 },
  //   { paymentPeriod: "36", principal: 0, interest: 24000 },
];

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  notation: "compact",
  style: "currency",
  currency: "USD",
});

const RepaymentScheduleLegend: ContentType = ({ payload }) => (
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

const StackedBarChart = () => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Legend
          content={RepaymentScheduleLegend}
          align="right"
          verticalAlign="top"
          wrapperStyle={{ paddingBottom: 32 }}
        />
        <XAxis dataKey="paymentPeriod" tick={{ fontSize: "10px" }} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickCount={5}
          tickFormatter={(value: number) => numberFormatter.format(value)}
          tick={{ fontSize: "10px", dx: -50, dy: -8, textAnchor: "start" }}
        />
        <CartesianGrid vertical={false} x={0} width={800} />
        <Tooltip />
        <Bar dataKey="principal" stackId="a" fill="#564928" />
        <Bar dataKey="interest" stackId="a" fill="#D7BD7A" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default StackedBarChart;
