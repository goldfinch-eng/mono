import { gql } from "@apollo/client";

import { Heading, Paragraph } from "@/components/typography";
import { useExampleQuery } from "@/lib/graphql/generated";

gql`
  query Example {
    seniorPools(first: 1) {
      id
      name @client
      description @client
      latestPoolStatus {
        id
        estimatedApy
        tranchedPools(first: 3) {
          id
          name @client
          description @client
          category @client
        }
      }
    }
  }
`;

export default function EarnPage() {
  const { data } = useExampleQuery();
  return (
    <div>
      <Heading level={1} className="mb-4">
        Earn Page
      </Heading>
      <Paragraph className="mb-12">
        This is the Earn page, AKA the home page of the app
      </Paragraph>
      <Heading level={2}>Example Data</Heading>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
