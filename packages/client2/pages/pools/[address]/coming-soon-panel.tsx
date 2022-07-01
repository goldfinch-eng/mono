import { differenceInDays, format } from "date-fns";

import { Button } from "@/components/design-system";
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
    <div className="flex flex-col rounded-xl border border-sand-200 text-center ">
      <div className="px-5 py-10">
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

      <div className="border-t border-sand-200 bg-sand-50 px-5 py-10">
        <p className="mx-5 mb-5">
          Subscribe to be the first to hear about new pool launches
        </p>
        <Button
          as="a"
          iconRight="ArrowTopRight"
          target="_blank"
          colorScheme="sky"
          size="xl"
          href="https://bit.ly/backer-updates"
          className="w-full"
        >
          Subscribe
        </Button>
      </div>
    </div>
  );
}
