import {
  SinglePoolCmsQuery,
  SingleTranchedPoolDataQuery,
} from "@/lib/graphql/generated";
import { PoolStatus } from "@/lib/pools";

import { DealTermsTable, SecuritiesRecourseTable } from "./deal-tables";
import { DocumentsList } from "./documents-list";
import { TransactionTable } from "./transaction-table";

interface DealSummaryProps {
  poolDetails?: SinglePoolCmsQuery["Deal"] | null;
  poolChainData?: SingleTranchedPoolDataQuery["tranchedPool"] | null;
  poolStatus: PoolStatus | null;
}

export default function DealSummary({
  poolDetails,
  poolChainData,
  poolStatus,
}: DealSummaryProps) {
  return (
    <>
      {poolDetails && poolChainData ? (
        <div>
          <div className="mb-20">
            <h2 className="mb-8 text-3xl">Deal Overview</h2>

            <p className="mb-8 whitespace-pre-wrap text-2xl font-light">
              {poolDetails.overview}
            </p>
          </div>

          <div className="mb-20">
            <h2 className="mb-8 text-lg font-semibold">Recent Activity</h2>

            <TransactionTable tranchedPoolId={poolChainData.id} />
          </div>

          {poolDetails?.highlights ? (
            <div className="mb-20">
              <h3 className="mb-8 text-lg font-semibold">Highlights</h3>
              <ul className="list-outside list-disc space-y-5 pl-5">
                {poolDetails?.highlights?.map((item, idx) => (
                  <li key={`pool-highlight-${poolDetails?.id}-${idx}`}>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {poolDetails?.useOfFunds ? (
            <div className="mb-20">
              <h3 className="mb-8 text-lg font-semibold">Use of Funds</h3>
              <p>{poolDetails.useOfFunds}</p>
            </div>
          ) : null}

          {poolDetails?.risks ? (
            <div className="mb-20">
              <h3 className="mb-8 text-lg font-semibold">Risks</h3>
              <p>{poolDetails.risks}</p>
            </div>
          ) : null}

          <div className="mb-20">
            <SecuritiesRecourseTable
              details={poolDetails.securitiesAndRecourse}
            />
          </div>

          <div className="mb-20">
            <DealTermsTable
              tranchedPool={poolChainData}
              poolStatus={poolStatus}
              defaultInterestRate={poolDetails.defaultInterestRate}
            />
          </div>

          {poolDetails.documents ? (
            <DocumentsList documents={poolDetails.documents} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
