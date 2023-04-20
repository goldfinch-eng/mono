import { gql } from "@apollo/client";
import NextLink from "next/link";

import {
  Button,
  InfoIconTooltip,
  Popover,
  ShimmerLines,
} from "@/components/design-system";
import { useIsMounted } from "@/hooks";
import { useAccountStatusQuery } from "@/lib/graphql/generated";
import { getUIDLabelFromGql } from "@/lib/verify";
import { useWallet } from "@/lib/wallet";

export function AccountButton() {
  const { account } = useWallet();
  const isMounted = useIsMounted();
  return !account || !isMounted ? null : (
    <Popover placement="bottom-end" content={<AccountStatus />}>
      <Button
        iconLeft="GoldfinchInverted"
        colorScheme="light-mustard"
        variant="rounded"
        size="sm"
      >
        <span className="hidden md:inline">Account</span>
      </Button>
    </Popover>
  );
}

gql`
  query AccountStatus($userId: ID!) {
    user(id: $userId) {
      id
      uidType
      isGoListed
    }
  }
`;

function AccountStatus() {
  const { account } = useWallet();
  const { data, loading, error } = useAccountStatusQuery({
    variables: { userId: account?.toLowerCase() ?? "" },
    skip: !account,
    fetchPolicy: "cache-and-network",
  });

  return (
    <div className="w-52">
      {error ? (
        <div className="text-clay-500">
          There was an error fetching your account data
        </div>
      ) : !data || loading ? (
        <ShimmerLines lines={2} />
      ) : (
        <div>
          <div className="mb-2 font-medium">
            {data.user?.uidType ? "UID" : "Set up UID"}
          </div>
          <div className="mb-4 text-sm">
            {data.user?.uidType ? (
              <div className="flex items-center justify-between">
                {getUIDLabelFromGql(data.user.uidType)}
                <InfoIconTooltip
                  size="sm"
                  content={
                    data.user.uidType === "US_NON_ACCREDITED_INDIVIDUAL"
                      ? "Limited eligibility means that you will not be able to participate in loans on Goldfinch, but you may participate in governance."
                      : "You may participate in all aspects of the Goldfinch protocol."
                  }
                />
              </div>
            ) : data.user?.isGoListed ? (
              "You are currently go-listed, but setting up a UID is strongly encouraged."
            ) : (
              "You need to set up your UID to start investing."
            )}
          </div>
          <NextLink href="/account" passHref>
            <Button className="block w-full" as="a" colorScheme="primary">
              Go to my account
            </Button>
          </NextLink>
        </div>
      )}
    </div>
  );
}
