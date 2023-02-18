import { gql } from "@apollo/client";
import { format } from "date-fns";

import {
  Button,
  InfoIconTooltip,
  ShimmerLines,
  Link,
  HeavyTable,
  HeavyTableRow,
} from "@/components/design-system";
import { RichText } from "@/components/rich-text";
import { formatCrypto, formatPercent, formatFiat } from "@/lib/format";
import {
  DealTermsTableFieldsFragment,
  SecuritiesRecourseTableFieldsFragment,
  BorrowerOtherPoolFieldsFragment,
  BorrowerFinancialsTableFieldsFragment,
  BorrowerPerformanceTableFieldsFragment,
  Deal_DealType,
} from "@/lib/graphql/generated";
import { PoolStatus } from "@/lib/pools";

export const DEAL_TERMS_TABLE_FIELDS = gql`
  fragment DealTermsTableFields on TranchedPool {
    id
    estimatedLeverageRatio
    fundableAt
    creditLine {
      interestAprDecimal
      limit
      paymentPeriodInDays
      termInDays
      borrowerContract {
        id
      }
      lateFeeApr
    }
  }
`;

export const SECURITIES_RECOURSE_TABLE_FIELDS = gql`
  fragment SecuritiesRecourseTableFields on Deal_SecuritiesAndRecourse {
    secured
    type
    description
    value
    recourse
    recourseDescription
    covenants
  }
`;

export const BORROWER_FINANCIALS_TABLE_FIELDS = gql`
  fragment BorrowerFinancialsTableFields on Borrower_BorrowerFinancials {
    totalLoansOriginated
    currentLoansOutstanding
    aum
    pastOffChainDeals {
      text
    }
    audited
    financialStatementSummary {
      url
    }
  }
`;

export const BORROWER_PERFORMANCE_TABLE_FIELDS = gql`
  fragment BorrowerPerformanceTableFields on Borrower_UnderwritingPerformance {
    performanceDocument {
      id
      filename
      url
    }
    underwritingDescription
    defaultRate
  }
`;

interface DealTermsProps {
  tranchedPool?: DealTermsTableFieldsFragment | null;
  poolStatus: PoolStatus | null;
  defaultInterestRate?: number | null;
  dealType?: Deal_DealType | null;
}

export function DealTermsTable({
  tranchedPool,
  poolStatus,
  defaultInterestRate,
  dealType,
}: DealTermsProps) {
  const isMultitranche = dealType === "multitranche";
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">On-chain data</h2>
          <div className="flex text-sand-400">
            <InfoIconTooltip
              size="sm"
              content="The Borrower's proposed terms for the Pool, including the loan's basic timeframe and conditions."
            />
          </div>
        </div>
        {tranchedPool && poolStatus !== PoolStatus.ComingSoon ? (
          <Button
            variant="rounded"
            colorScheme="secondary"
            iconRight="ArrowTopRight"
            as="a"
            href={`https://etherscan.io/address/${tranchedPool.id}`}
            target="_blank"
            rel="noopener"
          >
            Contract
          </Button>
        ) : null}
      </div>
      {!tranchedPool ? (
        <ShimmerLines truncateFirstLine={false} lines={8} />
      ) : (
        <HeavyTable
          rows={[
            [
              "Interest Rate",
              "The fixed interest rate APR paid by the Borrower to the Pool.",
              formatPercent(tranchedPool.creditLine.interestAprDecimal),
            ],
            [
              "Drawdown cap",
              "The total funds that the Borrower can drawdown from this Pool.",
              formatCrypto({
                token: "USDC",
                amount: tranchedPool.creditLine.limit,
              }),
            ],
            [
              "Payment frequency",
              "Frequency of interest and principal payments.",
              `${tranchedPool.creditLine.paymentPeriodInDays.toString()} days`,
            ],
            [
              "Payment term",
              "The length of time until the full principal is due.",
              `${tranchedPool.creditLine.termInDays.toString()} days`,
            ],
            [
              "Default interest rate",
              "An additional interest rate paid by the Borrower if they are late on their payments following the grace period. The total interest rate a Borrower in default pays =  interest rate + default interest rate.",
              formatPercent(
                defaultInterestRate
                  ? defaultInterestRate
                  : tranchedPool.creditLine.lateFeeApr
              ),
            ],
            [
              "Deal type",
              <div key="dealtype" className="max-w-sm">
                <p>
                  <b>Unitranche</b> - Pool is funded by a single class of
                  capital provider—either the Senior pool, or by Backers—to make
                  up a single tranche of financing. First loss capital doesn’t
                  exist for Unitranche Pools as all investors sit in the same
                  class.
                </p>
                <br />
                <p>
                  <b>Multitranche</b> - Pool is funded by two classes of capital
                  providers—both the Senior Pool and Backers—to make up two
                  tranches of financing. Backers act as the junior tranche of
                  investors, providing the Pool’s first-loss capital.
                </p>
              </div>,
              isMultitranche ? "Multitranche" : "Unitranche",
            ],
            [
              "Current leverage ratio",
              "The leverage of senior tranche to junior tranche capital in this Pool. Senior tranche capital is automatically allocated by Goldfinch's Senior Pool, according to the protocol's leverage model. Junior tranche capital is provided directly by Backer investments. A current leverage ratio of 4x means that for every $1 of junior capital deposited by Backers, $4 of senior capital will be allocated by the Senior Pool.",
              isMultitranche && tranchedPool.estimatedLeverageRatio
                ? `${tranchedPool.estimatedLeverageRatio
                    .toUnsafeFloat()
                    .toString()}x`
                : "N/A",
            ],
            [
              "Opening date",
              "The date that the Pool will be open for Backer investments.",
              format(new Date(tranchedPool.fundableAt * 1000), "MMMM d, y"),
            ],
            [
              "Contract address",
              "The Ethereum address for this Borrower Pool smart contract.",
              tranchedPool.id,
            ],
            [
              "Borrower address",
              "The Ethereum address associated with this Borrower.",
              tranchedPool.creditLine.borrowerContract.id,
            ],
          ]}
        />
      )}
    </div>
  );
}

interface SecuritiesRecourseTableProps {
  details?: SecuritiesRecourseTableFieldsFragment | null;
}

export function SecuritiesRecourseTable({
  details,
}: SecuritiesRecourseTableProps) {
  const rows: HeavyTableRow[] = [];
  if (details?.secured) {
    rows.push(["Secured", null, details.secured === "yes" ? "Yes" : "No"]);
  }
  if (details?.type) {
    rows.push(["Type of security", null, details.type]);
  }
  if (details?.description) {
    rows.push([
      "Security description",
      null,
      <RichText key="securityDescription" content={details.description} />,
    ]);
  }
  if (details?.value) {
    rows.push(["Security value", null, details.value.toString()]);
  }
  if (details?.recourse) {
    rows.push([
      "Recourse to borrower",
      null,
      details.recourse === "yes" ? "Yes" : "No",
    ]);
  }

  if (details?.recourseDescription) {
    rows.push([
      "Recourse description",
      null,
      <RichText
        key="recourseDescription"
        content={details.recourseDescription}
      />,
    ]);
  }
  if (details?.covenants) {
    rows.push([
      "Covenants",
      null,
      <RichText key="covenants" content={details.covenants} />,
    ]);
  }
  if (rows.length === 0) {
    return null;
  }
  return (
    <div>
      <h2 className="mb-8 text-lg font-semibold">Securities and recourse</h2>
      <HeavyTable rows={rows} />
    </div>
  );
}

interface BorrowerFinancialsTableProps {
  otherPools: BorrowerOtherPoolFieldsFragment[];
  borrowerFinancials?: BorrowerFinancialsTableFieldsFragment | null;
}

export function BorrowerFinancialsTable({
  otherPools,
  borrowerFinancials,
}: BorrowerFinancialsTableProps) {
  const rows: HeavyTableRow[] = [];

  if (borrowerFinancials?.totalLoansOriginated) {
    rows.push([
      "Total amount of loans originated to date",
      null,
      formatFiat({
        amount: borrowerFinancials.totalLoansOriginated,
        symbol: "USD",
      }),
    ]);
  }
  if (borrowerFinancials?.currentLoansOutstanding) {
    rows.push([
      "Current loans outstanding",
      null,
      formatFiat({
        amount: borrowerFinancials.currentLoansOutstanding,
        symbol: "USD",
      }),
    ]);
  }
  if (borrowerFinancials?.aum) {
    rows.push([
      "AUM",
      null,
      formatFiat({
        symbol: "USD",
        amount: borrowerFinancials.aum,
      }),
    ]);
  }
  if (otherPools.length > 0) {
    rows.push([
      "Past deals on-chain",
      null,
      <ul key="borrower-financials-list">
        {otherPools.map((deal) => (
          <li key={`borrower-financials-list-deal-${deal.id}`}>
            <Link href={`/pools/${deal.id}`} className="text-eggplant-700">
              {deal.name}
            </Link>
          </li>
        ))}
      </ul>,
    ]);
  }
  if (
    borrowerFinancials?.pastOffChainDeals &&
    borrowerFinancials.pastOffChainDeals.length > 0
  ) {
    rows.push([
      "Off-chain debt providers",
      null,
      <ul key="borrower-offchain-deals-list">
        {borrowerFinancials.pastOffChainDeals.map((item, idx) => (
          <li key={`borrower-offdeals-list-deal-${idx}`}>{item.text}</li>
        ))}
      </ul>,
    ]);
  }
  if (borrowerFinancials?.audited) {
    rows.push([
      "Audited",
      null,
      borrowerFinancials.audited === "yes" ? "Yes" : "No",
    ]);
  }
  if (borrowerFinancials?.financialStatementSummary?.url) {
    rows.push([
      "Financial statement summary",
      null,
      <Link
        key="financial summary"
        href={borrowerFinancials.financialStatementSummary.url as string}
        target="_blank"
        rel="noreferrer"
        iconRight="ArrowTopRight"
      >
        Link
      </Link>,
    ]);
  }
  if (rows.length === 0) {
    return null;
  }
  return (
    <div>
      <h2 className="mb-8 text-lg font-semibold">Borrower Financials</h2>
      <HeavyTable rows={rows} />
    </div>
  );
}

interface UnderwritingPerformanceTableProps {
  details?: BorrowerPerformanceTableFieldsFragment | null;
}

export function UnderwritingPerformanceTable({
  details,
}: UnderwritingPerformanceTableProps) {
  const rows: HeavyTableRow[] = [];
  if (details?.performanceDocument) {
    rows.push([
      "Performance and loss rate",
      null,
      <Link
        key={`borrower-performance-file-${details.performanceDocument.id}`}
        href={details.performanceDocument.url as string}
        target="_blank"
        className="text-eggplant-700 underline"
        rel="noreferrer"
      >
        {details.performanceDocument.filename as string}
      </Link>,
    ]);
  }
  if (details?.defaultRate) {
    rows.push(["Default rate", null, formatPercent(details.defaultRate)]);
  }
  if (details?.underwritingDescription) {
    rows.push([
      "Underwriting description",
      null,
      <RichText
        key="underwritingDescription"
        content={details.underwritingDescription}
      />,
    ]);
  }
  if (rows.length === 0) {
    return null;
  }
  return (
    <div>
      <h2 className="mb-8 text-lg font-semibold">
        Underwriting &amp; Performance
      </h2>
      <HeavyTable rows={rows} />
    </div>
  );
}
