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
  lastFullPaymentTime: number;
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
  query CallableLoanCallPoolTokens(
    $loanId: String!
    $lastFullPaymentTime: Int!
  ) {
    activePoolTokens: poolTokens(
      where: {
        loan: $loanId
        isCapitalCalled: true
        callDueAt_gte: $lastFullPaymentTime
      }
    ) {
      ...CallableLoanCallPoolTokensFields
    }
    paidPoolTokens: poolTokens(
      where: {
        loan: $loanId
        isCapitalCalled: true
        callDueAt_lt: $lastFullPaymentTime
      }
    ) {
      ...CallableLoanCallPoolTokensFields
    }
  }
`;

const generateCallsTableData = (
  poolTokens?: CallableLoanCallPoolTokensFieldsFragment[]
) => {
  if (!poolTokens || poolTokens.length === 0) {
    return [];
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

  return callsTableData;
};

export function CallableLoanCallsPanel({
  loanId,
  lastFullPaymentTime,
}: CallableLoanCallsPanel) {
  const { data, loading } = useCallableLoanCallPoolTokensQuery({
    variables: {
      loanId,
      lastFullPaymentTime,
    },
  });

  const activePoolTokens = data?.activePoolTokens;
  const paidPoolTokens = data?.paidPoolTokens;

  const activeCallsTableData = generateCallsTableData(activePoolTokens);
  const paidCallsTableData = generateCallsTableData(paidPoolTokens);

  return (
    <div className="mb-10 rounded-xl bg-sand-100 p-8">
      <div className="mb-6 text-2xl">Active callable loans</div>
      <LoanCallsDataTable
        callsData={activeCallsTableData}
        loading={loading}
        className="mb-16"
      />
      <div className="mb-6 text-2xl">Callable loans history</div>
      <LoanCallsDataTable callsData={paidCallsTableData} loading={loading} />
      {paidCallsTableData.length > 5 && (
        <Button className="mt-2.5 w-full" colorScheme="sand" size="lg">
          View more
        </Button>
      )}
    </div>
  );
}
