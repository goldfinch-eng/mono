import clsx from "clsx";
import { BigNumber } from "ethers";
import { ReactNode, useState } from "react";

import { Icon } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { CryptoAmount, SupportedCrypto } from "@/lib/graphql/generated";

interface Holding {
  name: string;
  percentage: number;
  quantity: BigNumber;
  usdcValue: CryptoAmount;
}

interface ExpandableHoldingsProps {
  title: string;
  color: string;
  holdings: Holding[];
  quantityFormatter: (n: BigNumber) => ReactNode;
}

export function ExpandableHoldings({
  title,
  color,
  holdings,
  quantityFormatter,
}: ExpandableHoldingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
      <div className="relative flex justify-between bg-white px-5 py-6 hover:bg-sand-100">
        <div className="flex items-center gap-3">
          <div
            className="h-3.5 w-3.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {title}
        </div>
        <div>{formatPercent(totalPercentage)}</div>
        <div>{quantityFormatter(totalQuantity)}</div>
        <div className="flex items-center gap-3">
          <div>{formatCrypto(totalUsdcValue)}</div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="before:absolute before:inset-0"
          >
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
        <div className="divide-y divide-sand-200 border-t border-sand-200 bg-sand-50 px-5">
          {holdings.map((holding, index) => (
            <IndividualHolding
              key={holding.name + index}
              name={holding.name}
              percentage={holding.percentage}
              quantity={holding.quantity}
              quantityFormatter={quantityFormatter}
              usdcValue={holding.usdcValue}
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
}: IndividualHoldingProps) {
  return (
    <div className="flex justify-between py-5">
      <div>{name}</div>
      <div>{formatPercent(percentage)}</div>
      <div>{quantityFormatter(quantity)}</div>
      <div>{formatCrypto(usdcValue)}</div>
    </div>
  );
}
