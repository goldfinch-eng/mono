import { Heading } from "@/components/design-system";

import { TransactionTable } from "./transaction-table";

export default function TransactionsPage() {
  return (
    <div>
      <Heading as="h1" level={2} className="mb-12 text-center lg:text-left">
        Transactions
      </Heading>
      <TransactionTable />
    </div>
  );
}
