import clsx from "clsx";

import { Heading, Icon, InfoIconTooltip } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { CryptoAmount } from "@/lib/graphql/generated";

export const BORROWER_POOL_COLOR_CLASS = "bg-eggplant-300";
export const GFI_COLOR_CLASS = "bg-mustard-450";
export const SENIOR_POOL_COLOR_CLASS = "bg-mint-300";
export const CURVE_COLOR_CLASS = "bg-tidepool-600";

interface Holding {
  name: string;
  tooltip?: string;
  colorClass: string;
  /**
   * CryptoAmount expressed in USDC
   */
  usdc: CryptoAmount;
  percentage: number;
}

interface PortfolioSummaryProps {
  className?: string;
  holdings: Holding[];
  totalUsdc: CryptoAmount;
}

export function PortfolioSummary({
  className,
  holdings,
  totalUsdc,
}: PortfolioSummaryProps) {
  return (
    <div
      className={clsx(
        "grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-sand-200 bg-sand-200 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      <div className="col-span-full bg-white px-5 py-7">
        <div className="mb-9 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <Heading level={2} className="!font-sans !text-3xl !font-normal">
            Portfolio summary
          </Heading>
          <div className="flex items-center gap-3 text-3xl font-medium">
            {formatCrypto(totalUsdc, {
              includeSymbol: true,
              includeToken: false,
            })}
            <Icon name="Usdc" size="sm" />
          </div>
        </div>
        <div className="flex h-8 w-full items-stretch overflow-hidden rounded">
          {holdings.map((holding) => (
            <div
              key={holding.name}
              className={holding.colorClass}
              style={{ width: `${holding.percentage * 100}%` }}
            />
          ))}
        </div>
      </div>
      {holdings.map((holding) => (
        <Holding key={holding.name} {...holding} />
      ))}
    </div>
  );
}

function Holding({ name, tooltip, colorClass, usdc, percentage }: Holding) {
  return (
    <div className="bg-white px-5 py-6">
      <div className="mb-3 flex items-center gap-3">
        <div
          className={clsx("h-3.5 w-3.5 flex-shrink-0 rounded-full", colorClass)}
        />
        <div className="text-sm text-sand-600">{name}</div>
        {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
      </div>
      <div className="flex justify-between gap-4 text-lg">
        <div className="font-medium text-sand-700">
          {formatCrypto(usdc, { includeSymbol: true, includeToken: false })}
        </div>
        <div className="text-sand-500">{formatPercent(percentage)}</div>
      </div>
    </div>
  );
}
