import { gql } from "@apollo/client";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import {
  Button,
  Icon,
  Spinner,
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system";
import { CallToActionBanner } from "@/components/design-system";
import { PARALLEL_MARKETS } from "@/constants";
import { useIsMounted } from "@/hooks";
import { useAccountPageQuery } from "@/lib/graphql/generated";
import { openVerificationModal, openWalletModal } from "@/lib/state/actions";
import {
  getSignatureForKyc,
  getUIDLabelFromGql,
  registerKyc,
} from "@/lib/verify";
import { useWallet } from "@/lib/wallet";
import { NextPageWithLayout } from "@/pages/_app.page";

gql`
  query AccountPage($account: ID!) {
    user(id: $account) {
      uidType
    }
    viewer @client {
      kycStatus {
        status
        identityStatus
        accreditationStatus
      }
    }
  }
`;

const DEFAULT_UID_ICON = "Globe";

const AccountsPage: NextPageWithLayout = () => {
  const isMounted = useIsMounted();
  const { account, provider, signer } = useWallet();
  const { data, error, loading, refetch } = useAccountPageQuery({
    variables: { account: account?.toLowerCase() ?? "" },
  });
  const router = useRouter();

  const [isRegisteringKyc, setIsRegisteringKyc] = useState(false);
  const [registerKycError, setRegisterKycError] = useState<Error>();

  useEffect(() => {
    if (!router.isReady || !signer || !account) {
      return;
    }
    const asyncEffect = async () => {
      setIsRegisteringKyc(true);
      setRegisterKycError(undefined);
      try {
        /* Check for cross-site forgery on redirection to account page from parallel markets when page first renders */
        if (router.query.state !== undefined) {
          const parallel_markets_state = sessionStorage.getItem(
            PARALLEL_MARKETS.STATE_KEY
          );
          if (router.query.state !== parallel_markets_state) {
            throw new Error(
              "Detected a possible cross-site request forgery attack on your Parallel Markets session. Please try authenticating with Parallel Markets through Goldfinch again."
            );
          }
        }
        if (router.query.error === "access_denied") {
          throw new Error(
            "You have declined to give Goldfinch consent for authorization to Parallel Markets. Please try authenticating with Parallel Markets through Goldfinch again."
          );
        }
        if (router.query.code !== undefined && account && provider) {
          const plaintext = `Share your OAuth code with Goldfinch: ${router.query.code}`;
          const sig = await getSignatureForKyc(provider, signer, plaintext);
          await registerKyc(account, sig);
          router.replace("/account");
          await refetch();
        }
      } catch (e) {
        setRegisterKycError(e as Error);
      } finally {
        setIsRegisteringKyc(false);
      }
    };
    asyncEffect();
    // signer is not identity-stable and can't be included in the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, provider, !!signer, router, router.isReady, refetch]);
  const { status, identityStatus, accreditationStatus } =
    data?.viewer.kycStatus ?? {};

  const { uidType } = data?.user ?? {};

  return (
    <div>
      <div className="bg-mustard-100">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <h1 className="font-serif text-5xl font-bold text-sand-800">
            Account
          </h1>
          {error ? (
            <div className="text-xl text-clay-500">
              Unable to fetch data for your account. Please refresh the page and
              provide your signature.
            </div>
          ) : null}
        </div>
      </div>
      {!isMounted ? null : !account ? (
        <div className="mx-auto mt-5 max-w-7xl px-5">
          You must connect your wallet to view account information.
          <div>
            <Button onClick={openWalletModal}>Connect</Button>
          </div>
        </div>
      ) : (
        <TabGroup>
          <div className="bg-mustard-100">
            <div className="mx-auto max-w-7xl px-5">
              <TabList>
                <TabButton>UID and Wallets</TabButton>
              </TabList>
            </div>
          </div>
          <div className="px-5">
            <div className="mx-auto max-w-7xl pt-0">
              <TabPanels>
                <TabContent>
                  {isRegisteringKyc || loading ? (
                    <Spinner size="lg" />
                  ) : uidType ? (
                    <div className="lg:px-5">
                      <div className="flex flex-col gap-y-2">
                        <h2 className="text-sand-500">Information</h2>
                        <div>{getUIDLabelFromGql(uidType)}</div>
                      </div>
                      <hr className="my-4 fill-sand-300"></hr>
                      <div className="flex flex-col gap-y-2">
                        <h2 className="text-sand-500">Main wallet</h2>
                        <div className="break-words">{account}</div>
                      </div>
                    </div>
                  ) : status === "pending" ? (
                    <CallToActionBanner
                      iconLeft={DEFAULT_UID_ICON}
                      title="UID is being verified"
                      description="Almost there. Your UID is still being verified, please come back later."
                      colorScheme="white"
                    >
                      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                        <CheckableStep name="Documents uploaded" checked />
                        <CheckableStep
                          name="Identity verification"
                          checked={identityStatus === "approved"}
                        />
                        <CheckableStep
                          name="Accreditation verification"
                          checked={accreditationStatus === "approved"}
                        />
                      </div>
                    </CallToActionBanner>
                  ) : status === "approved" ? (
                    <CallToActionBanner
                      renderButton={(props) => (
                        <Button {...props} onClick={openVerificationModal}>
                          Claim UID
                        </Button>
                      )}
                      colorScheme="green"
                      iconLeft={DEFAULT_UID_ICON}
                      title="Claim your UID"
                      description="Your application is approved! Claim your UID to participate in the protocol."
                    />
                  ) : (
                    <CallToActionBanner
                      renderButton={(props) => (
                        <Button {...props} onClick={openVerificationModal}>
                          {registerKycError ? "Try again" : "Begin UID setup"}
                        </Button>
                      )}
                      iconLeft={
                        registerKycError ? "Exclamation" : DEFAULT_UID_ICON
                      }
                      title={
                        registerKycError
                          ? "There was a problem connecting to our verification partner"
                          : "Setup your UID to start"
                      }
                      description={
                        registerKycError
                          ? registerKycError.message
                          : "UID is a non-transferrable NFT representing KYC-verification on-chain. A UID is required to participate in the Goldfinch lending protocol. No personal information is stored on-chain."
                      }
                    />
                  )}
                </TabContent>
              </TabPanels>
            </div>
          </div>
        </TabGroup>
      )}
    </div>
  );
};

AccountsPage.layout = "naked";

export default AccountsPage;

function CheckableStep({ name, checked }: { name: string; checked: boolean }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-1 rounded-md bg-mint-100 p-4 text-sm sm:w-1/3",
        checked ? "bg-mint-100 text-sand-700" : "bg-sand-100 text-sand-400"
      )}
    >
      <Icon
        name="Checkmark"
        className={checked ? "fill-mint-450" : "fill-sand-300"}
      />
      <div>{name}</div>
    </div>
  );
}
