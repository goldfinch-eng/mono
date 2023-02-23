import { differenceInCalendarDays, format } from "date-fns";

import { Button, Tooltip } from "@/components/design-system";

interface ComingSoonPanelProps {
  /**
   * This should be a timestamp is seconds, not ms
   */
  fundableAt: number;
}

export function ComingSoonPanel({ fundableAt }: ComingSoonPanelProps) {
  if (fundableAt === 0) {
    return null;
  }

  const date = new Date(fundableAt * 1000);
  const difference = differenceInCalendarDays(date, new Date());

  return (
    <div className="text-center">
      <div className="mb-5">
        <div className="mb-5 text-xl">
          This pool will open on{" "}
          <Tooltip useWrapper content={`at ${format(date, "h:mm aaaa")}`}>
            <span className="font-semibold text-sand-800">
              {format(date, "MMMM d, y")}
            </span>
          </Tooltip>
        </div>

        <div className="font-serif text-7xl font-semibold leading-none text-sand-800">
          {difference === 0 ? "Today" : difference}
        </div>

        {difference !== 0 && <div>{difference === 1 ? "Day" : "Days"}</div>}
      </div>

      <div>
        <p className="mx-5 mb-5">
          Subscribe to be the first to hear about new pool launches
        </p>
        <Button
          as="a"
          iconRight="ArrowTopRight"
          target="_blank"
          rel="noreferer noopener"
          colorScheme="mustard"
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
