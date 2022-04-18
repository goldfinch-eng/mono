import { formatDollarAmount } from "@/lib/format";

interface FundingBarProps {
  goal: number;
  backerSupply: number;
  seniorSupply: number;
}

export default function FundingBar({
  goal,
  backerSupply,
  seniorSupply,
}: FundingBarProps) {
  const backerWidth = (backerSupply / goal) * 100;
  const seniorWidth = (seniorSupply / goal) * 100;

  return (
    <div className="relative">
      <div
        className="mb-3 flex items-center justify-end text-sm text-sand-600"
        style={{
          marginRight: `${100 - backerWidth - seniorWidth}%`,
        }}
      >
        Supplied{" "}
        <span className="ml-3 inline-block text-base font-medium text-sand-700">
          {formatDollarAmount(backerSupply + seniorSupply)}
        </span>
      </div>
      <div className="relative mb-3 h-8 overflow-hidden rounded bg-sand-200 bg-diagonals bg-repeat">
        <div
          className="absolute left-0 top-0 bottom-0 bg-[#954586]"
          style={{
            width: `${backerWidth}%`,
          }}
        ></div>
        <div
          className="absolute top-0 bottom-0 bg-[#60B1DE]"
          style={{
            left: `${backerWidth}%`,
            width: `${seniorWidth}%`,
          }}
        ></div>
      </div>
      <div className="flex items-center justify-end text-sm text-sand-600">
        Goal{" "}
        <span className="ml-3 inline-block text-base font-medium text-sand-700">
          {formatDollarAmount(goal)}
        </span>
      </div>
    </div>
  );
}
