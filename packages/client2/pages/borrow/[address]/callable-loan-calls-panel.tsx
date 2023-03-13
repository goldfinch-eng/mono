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

interface CallableLoanCallsPanel {
  loanId: string;
}

gql`
  fragment CallableLoanCallPoolTokensFields on PoolToken {
    id
    principalAmount
    callDueAt
    principalRedeemed
    principalRedeemable
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
  poolTokens?: CallableLoanCallPoolTokensFieldsFragment[]
) => {
  if (!poolTokens || poolTokens.length === 0) {
    return { activeCallsTableData: [], closedCallsTableData: [] };
  }

  const callsTableDataIndexedByCallDueAt: {
    [key: number]: LoanCallsDataTableRow;
  } = {};

  poolTokens.forEach((token) => {
    if (token?.callDueAt) {
      if (callsTableDataIndexedByCallDueAt[token.callDueAt]) {
        const existingCallEntry =
          callsTableDataIndexedByCallDueAt[token.callDueAt];
        const newTotalCalled = existingCallEntry.totalCalled.add(
          token.principalAmount
        );
        const newBalance = token.principalAmount
          .sub(token.principalRedeemable)
          .add(existingCallEntry.balance);

        callsTableDataIndexedByCallDueAt[token.callDueAt] = {
          ...existingCallEntry,
          totalCalled: newTotalCalled,
          balance: newBalance,
          status: newBalance.isZero() ? "Closed" : "Open",
        };
      } else {
        const balance = token.principalAmount.sub(token.principalRedeemable);

        callsTableDataIndexedByCallDueAt[token.callDueAt] = {
          totalCalled: token.principalAmount,
          dueDate: token.callDueAt,
          status: balance.isZero() ? "Closed" : "Open",
          balance: token.principalAmount.sub(token.principalRedeemable),
        };
      }
    }
  });

  const callsTableData = Object.values(callsTableDataIndexedByCallDueAt).sort(
    (a, b) => a.dueDate - b.dueDate
  );

  const activeCallsTableData = callsTableData.filter(
    (tableData) => tableData.status === "Open"
  );
  const closedCallsTableData = callsTableData.filter(
    (tableData) => tableData.status === "Closed"
  );

  return { activeCallsTableData, closedCallsTableData };
};

export function CallableLoanCallsPanel({ loanId }: CallableLoanCallsPanel) {
  const { data, loading } = useCallableLoanCallPoolTokensQuery({
    variables: {
      loanId,
    },
  });

  const poolTokens = data?.poolTokens;
  const { activeCallsTableData, closedCallsTableData } =
    generateCallsTableData(poolTokens);

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
