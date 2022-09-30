import { RichText } from "@/components/rich-text";
import {
  SingleDealQuery,
  SingleTranchedPoolDataQuery,
} from "@/lib/graphql/generated";
import { PoolStatus } from "@/lib/pools";

import { DealTermsTable, SecuritiesRecourseTable } from "./deal-tables";
import { DocumentsList } from "./documents-list";
import { FileItem } from "./subcomponents/file-item";
import { TransactionTable } from "./transaction-table";

interface DealSummaryProps {
  dealData: NonNullable<SingleDealQuery["Deal"]>;
  poolChainData: NonNullable<SingleTranchedPoolDataQuery["tranchedPool"]>;
  poolStatus: PoolStatus;
}

export default function DealSummary({
  dealData,
  poolChainData,
  poolStatus,
}: DealSummaryProps) {
  return (
    <div>
      <div className="mb-20">
        <h2 className="mb-8 text-3xl">Deal Overview</h2>

        <RichText
          content={dealData.overview}
          className="mb-8 whitespace-pre-wrap text-2xl font-light"
        />
      </div>

      <div className="mb-20">
        <h2 className="mb-8 text-lg font-semibold">Recent Activity</h2>

        <TransactionTable tranchedPoolId={poolChainData.id} />
      </div>

      {dealData.details ? (
        <RichText content={dealData.details} className="mb-20" />
      ) : null}

      {dealData.transactionStructure ? (
        <div className="mb-20">
          <h3 className="mb-8 text-lg font-semibold">Transaction Structure</h3>
          <FileItem
            filename={dealData.transactionStructure.filename as string}
            description={dealData.transactionStructure.alt}
            url={dealData.transactionStructure.url as string}
            mimeType={dealData.transactionStructure.mimeType as string}
          />
        </div>
      ) : null}

      <div className="mb-20">
        <SecuritiesRecourseTable details={dealData.securitiesAndRecourse} />
      </div>

      <div className="mb-20">
        <DealTermsTable
          tranchedPool={poolChainData}
          poolStatus={poolStatus}
          defaultInterestRate={dealData.defaultInterestRate}
        />
      </div>

      {dealData.documents && dealData.documents.length > 0 ? (
        <DocumentsList documents={dealData.documents} />
      ) : null}
    </div>
  );
}
