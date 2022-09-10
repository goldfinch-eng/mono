import clsx from "clsx";
import { BigNumber } from "ethers";
import Link from "next/link";
import { ReactNode } from "react";

import { Icon, InfoIconTooltip, Shimmer } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { CryptoAmount, SupportedCrypto } from "@/lib/graphql/generated";

interface Holding {
  name: string;
  percentage: number;
  quantity: BigNumber;
  usdcValue: CryptoAmount;
  url?: string;
}

interface ExpandableHoldingsProps {
  title: string;
  tooltip?: string;
  colorClass: string;
  holdings: Holding[];
  quantityFormatter: (n: BigNumber) => ReactNode;
  isExpanded: boolean;
  onClick: () => void;
}

const gridClasses =
  "grid grid-cols-1 xs:grid-cols-3 gap-3 md:grid-cols-5 justify-items-end";
const gridHeadingClasses = "justify-self-start xs:col-span-3 md:col-span-2";

export function ExpandableHoldings({
  title,
  tooltip,
  colorClass,
  holdings,
  quantityFormatter,
  isExpanded,
  onClick,
}: ExpandableHoldingsProps) {
  const totalPercentage = holdings.reduce(
    (prev, current) => prev + current.percentage,
    0
  );
  const totalQuantity = holdings.reduce(
    (prev, current) => prev.add(current.quantity),
    BigNumber.from(0)
  );
  const totalUsdcValue = {
    token: SupportedCrypto.Usdc,
    amount: holdings.reduce(
      (prev, current) => prev.add(current.usdcValue.amount),
      BigNumber.from(0)
    ),
  };
  return (
    <div className="overflow-hidden rounded-xl border border-sand-200">
      <div
        className={clsx(
          gridClasses,
          "relative bg-white px-5 py-6 hover:bg-sand-100"
        )}
      >
        <div
          className={clsx(
            gridHeadingClasses,
            "relative z-10 flex items-center gap-3 text-lg"
          )}
        >
          <div
            className={clsx(
              "h-3.5 w-3.5 flex-shrink-0 rounded-full",
              colorClass
            )}
          />
          {title}
          {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
        </div>
        <div>{formatPercent(totalPercentage)}</div>
        <div>{quantityFormatter(totalQuantity)}</div>
        <div className="flex items-center gap-3">
          <div>{formatCrypto(totalUsdcValue)}</div>
          <button onClick={onClick} className="before:absolute before:inset-0">
            <Icon
              name="ChevronDown"
              size="md"
              className={clsx(
                "transition-transform",
                isExpanded ? "rotate-180" : null
              )}
            />
          </button>
        </div>
      </div>
      {isExpanded ? (
        <div className="divide-y divide-sand-200 border-t border-sand-200">
          {holdings.map((holding, index) => (
            <IndividualHolding
              key={holding.name + index}
              name={holding.name}
              percentage={holding.percentage}
              quantity={holding.quantity}
              quantityFormatter={quantityFormatter}
              usdcValue={holding.usdcValue}
              url={holding.url}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface IndividualHoldingProps extends Holding {
  quantityFormatter: ExpandableHoldingsProps["quantityFormatter"];
}

function IndividualHolding({
  name,
  percentage,
  quantity,
  quantityFormatter,
  usdcValue,
  url,
}: IndividualHoldingProps) {
  return (
    <div
      className={clsx(
        gridClasses,
        "group bg-sand-50 p-5",
        url ? "relative hover:bg-sand-100" : null
      )}
    >
      <div className={gridHeadingClasses}>
        {url ? (
          <Link href={url}>
            <a className="before:absolute before:inset-0 group-hover:underline">
              {name}
            </a>
          </Link>
        ) : (
          name
        )}
      </div>
      <div>{formatPercent(percentage)}</div>
      <div>{quantityFormatter(quantity)}</div>
      <div className="flex items-center">
        {formatCrypto(usdcValue)}
        <Icon
          name="ChevronDown"
          className={clsx(
            "pointer-events-none ml-3 -rotate-90",
            !url ? "invisible" : ""
          )}
          size="md"
        />
      </div>
    </div>
  );
}

export function ExpandableHoldingsPlaceholder() {
  return (
    <div className="overflow-hidden rounded-xl border border-sand-200">
      <div className={clsx(gridClasses, "bg-white px-5 py-6")}>
        <Shimmer isTruncated className={gridHeadingClasses} />
        <Shimmer isTruncated />
        <Shimmer isTruncated />
        <Shimmer isTruncated />
      </div>
    </div>
  );
}
