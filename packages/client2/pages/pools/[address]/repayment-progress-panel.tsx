import { gql } from "@apollo/client";
import clsx from "clsx";
import { format } from "date-fns";
import { BigNumber } from "ethers";

import { InfoIconTooltip, Icon } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SupportedCrypto,
  RepaymentProgressPanelTranchedPoolFieldsFragment,
} from "@/lib/graphql/generated";

export const REPAYMENT_PROGRESS_PANEL_FIELDS = gql`
  fragment RepaymentProgressPanelTranchedPoolFields on TranchedPool {
    id
    estimatedJuniorApy
    totalAmountRepaid
    creditLine {
      nextDueTime
    }
  }
`;

interface RepaymentProgressPanelProps {
  tranchedPool: RepaymentProgressPanelTranchedPoolFieldsFragment;
  userInvestment?: BigNumber;
}

export default function RepaymentProgressPanel({
  tranchedPool,
}: RepaymentProgressPanelProps) {
  return (
    <div className="rounded-xl border border-sand-200">
      <div className="p-5">
        <div>
          <LittleHeading tooltipContent="Total amount repaid by the borrower, including interest.">
            Total amount repaid
          </LittleHeading>
          <div className="mb-2 flex items-center justify-between">
            <BigText icon="Usdc">
              {formatCrypto(
                {
                  token: SupportedCrypto.Usdc,
                  amount: tranchedPool.totalAmountRepaid,
                },
                { includeSymbol: true }
              )}
            </BigText>
            <div className="text-xl">
              {formatPercent(tranchedPool.estimatedJuniorApy)}
            </div>
          </div>
        </div>
      </div>

      <hr className="border-t border-sand-200" />

      <div className="p-5">
        <LittleHeading>Next repayment date</LittleHeading>
        <BigText>
          {format(
            tranchedPool.creditLine.nextDueTime.toNumber() * 1000,
            "MMM d, y"
          )}
        </BigText>
      </div>
    </div>
  );
}

function LittleHeading({
  children,
  tooltipContent,
  className,
}: {
  children: string;
  tooltipContent?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "mb-2 flex items-center justify-between gap-3 text-sand-700",
        className
      )}
    >
      <div className="text-sm">{children}</div>
      {tooltipContent ? (
        <InfoIconTooltip size="sm" content={tooltipContent} placement="top" />
      ) : null}
    </div>
  );
}

function BigText({
  children,
  icon,
}: {
  children: string;
  icon?: "Usdc" | "Gfi";
}) {
  return (
    <div className="flex items-center gap-2 text-3xl">
      {children}
      {icon ? <Icon name={icon} size="sm" /> : null}
    </div>
  );
}
