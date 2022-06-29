import { differenceInDays, format } from "date-fns";

import type { TranchedPool } from "@/lib/graphql/generated";

interface ComingSoonPanelProps {
  fundableAt: TranchedPool["fundableAt"];
}

export default function ComingSoonPanel({ fundableAt }: ComingSoonPanelProps) {
  if (fundableAt.isZero()) {
    return <></>;
  }

  const date = new Date(fundableAt.toNumber() * 1000);
  const difference = differenceInDays(date, new Date());

  return (
    <div className="flex flex-col items-center rounded-xl border border-sand-200 px-5 py-10">
      <div className="mb-5 text-xl">
        This pool will open on{" "}
        <span className="font-semibold text-sky-700">
          {format(date, "MMMM d, y")}
        </span>
      </div>

      <div className="text-[7.5rem] font-semibold leading-none text-sky-700">
        {difference === 0 ? "Today" : difference}
      </div>

      {difference !== 0 && <div>{difference === 1 ? "Day" : "Days"}</div>}
    </div>
  );
}
