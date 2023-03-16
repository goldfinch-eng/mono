import { BigNumber } from "ethers/lib/ethers";
import { gql } from "graphql-request";

import { Button } from "@/components/design-system";
import {
  CallableLoanCallPoolTokensFieldsFragment,
  useCallableLoanCallPoolTokensQuery,
} from "@/lib/graphql/generated";
import {
  LoanCallsDataTable,
  LoanCallsDataTableRow,
} from "@/pages/borrow/[address]/loan-calls-data-table";

interface CallableLoanCallsPanelProps {
  loanId: string;
  principalAmountRepaid?: BigNumber;
}

gql`
  fragment CallableLoanCallPoolTokensFields on PoolToken {
    id
    principalAmount
    callDueAt
  }
`;

gql`
  query CallableLoanCallPoolTokens($loanId: String!) {
    poolTokens(where: { loan: $loanId, isCapitalCalled: true }) {
      ...CallableLoanCallPoolTokensFields
    }
  }
`;

const generateCallsTableData = (
  poolTokens?: CallableLoanCallPoolTokensFieldsFragment[],
  principalAmountRepaid?: BigNumber
) => {
  if (!poolTokens || (poolTokens.length === 0 && !principalAmountRepaid)) {
    return { activeCallsTableData: [], closedCallsTableData: [] };
  }

  const callsTableDataIndexedByCallDueAt: {
    [key: number]: LoanCallsDataTableRow;
  } = {};

  // Create map of calls table data indexed by "callDueAt"
  poolTokens.forEach((token) => {
    if (token?.callDueAt) {
      if (callsTableDataIndexedByCallDueAt[token.callDueAt]) {
        const existingCallEntry =
          callsTableDataIndexedByCallDueAt[token.callDueAt];
        const newTotalCalled = existingCallEntry.totalCalled.add(
          token.principalAmount
        );

        callsTableDataIndexedByCallDueAt[token.callDueAt] = {
          ...existingCallEntry,
          totalCalled: newTotalCalled,
          balance: newTotalCalled,
        };
      } else {
        callsTableDataIndexedByCallDueAt[token.callDueAt] = {
          totalCalled: token.principalAmount,
          dueDate: token.callDueAt,
          status: "Open",
          balance: token.principalAmount,
        };
      }
    }
  });

  // Sort by "dueDate" ascending
  const callsTableData = Object.values(callsTableDataIndexedByCallDueAt).sort(
    (a, b) => a.dueDate - b.dueDate
  );

  const activeCallsTableData: LoanCallsDataTableRow[] = [];
  const closedCallsTableData: LoanCallsDataTableRow[] = [];
  let totalPrincipalAmountRepaid = principalAmountRepaid as BigNumber;

  // This updates the balance and status of call entries using "principalAmountRepaid".
  // It distributes the repayment amount among the entries and sets their status to "Open" or "Closed" accordingly.
  for (const callData of callsTableData) {
    if (totalPrincipalAmountRepaid.gte(callData.balance)) {
      totalPrincipalAmountRepaid = totalPrincipalAmountRepaid.sub(
        callData.balance
      );
      callData.balance = BigNumber.from(0);
      callData.status = "Closed";
      closedCallsTableData.push(callData);
    } else {
      callData.balance = callData.balance.sub(totalPrincipalAmountRepaid);
      callData.status = "Open";
      totalPrincipalAmountRepaid = BigNumber.from(0);
      activeCallsTableData.push(callData);
    }
  }

  return { activeCallsTableData, closedCallsTableData };
};

export function CallableLoanCallsPanel({
  loanId,
  principalAmountRepaid,
}: CallableLoanCallsPanelProps) {
  const { data, loading } = useCallableLoanCallPoolTokensQuery({
    variables: {
      loanId,
    },
  });

  const poolTokens = data?.poolTokens;
  const { activeCallsTableData, closedCallsTableData } = generateCallsTableData(
    poolTokens,
    principalAmountRepaid
  );

  return (
    <div className="mb-10 rounded-xl bg-sand-100 p-8">
      <div className="mb-6 text-2xl">Active callable loans</div>
      <LoanCallsDataTable
        callsData={activeCallsTableData}
        loading={loading}
        className="mb-16"
      />
      <div className="mb-6 text-2xl">Callable loans history</div>
      <LoanCallsDataTable callsData={closedCallsTableData} loading={loading} />
      {closedCallsTableData.length > 5 && (
        <Button className="mt-2.5 w-full" colorScheme="sand" size="lg">
          View more
        </Button>
      )}
    </div>
  );
}
