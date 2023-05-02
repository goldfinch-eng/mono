import { gql } from "@apollo/client";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import {
  Button,
  ButtonProps,
  Icon,
  Link,
  Spinner,
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system";
import { CallToActionBanner } from "@/components/design-system";
import { PARALLEL_MARKETS, SETUP_UID_BANNER_TEXT } from "@/constants";
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
        kycProvider
        status
        identityStatus
        accreditationStatus
        countryCode
        type
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
    skip: !account,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true, // causes `loading` to become true again when refetch is called
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
        if (router.query.code !== undefined && provider) {
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
  const {
    status,
    identityStatus,
    accreditationStatus,
    kycProvider,
    countryCode,
    type,
  } = data?.viewer.kycStatus ?? {};

  const { uidType } = data?.user ?? {};
  const hasUID = !!uidType;

  return (
    <div>
      <div className="bg-mustard-100">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <h1 className="font-serif text-5xl font-bold text-sand-800">
            Account
          </h1>
        </div>
      </div>
      {!isMounted ? null : !account ? (
        <div className="mx-auto mt-5 max-w-7xl px-5">
          <div className="my-5">
            You must connect your wallet to view account information.
          </div>
          <Button onClick={openWalletModal}>Connect</Button>
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
                  {error ? (
                    <div className="text-xl text-clay-500">
                      Unable to fetch data for your account. Error:{" "}
                      {error.message}
                    </div>
                  ) : registerKycError ? (
                    <CallToActionBanner
                      colorScheme="red"
                      title="There was a problem connecting to our verification partner"
                      iconLeft="Exclamation"
                      description={registerKycError.message}
                      renderButton={(props) => (
                        <Button {...props} onClick={openVerificationModal}>
                          Try again
                        </Button>
                      )}
                    />
                  ) : isRegisteringKyc || loading ? (
                    <div className="flex items-center gap-4">
                      <Spinner size="lg" />
                      <div className="text-lg">
                        {isRegisteringKyc
                          ? "Connecting to our verification partner, this requires a signature"
                          : "Fetching your account data, this requires a signature"}
                      </div>
                    </div>
                  ) : hasUID ? (
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
                      description={
                        kycProvider === "parallelMarkets"
                          ? "Almost there. Your UID is still being verified. After you have completed verification, you will receive an email within 72 hours."
                          : "Almost there. Your UID is still being verified."
                      }
                      colorScheme="white"
                    >
                      <>
                        <div className="my-8 flex flex-col gap-2 sm:flex-row">
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
                        <p className="text-sm">
                          <>
                            If you are still facing a delay, please email us at{" "}
                            <Link
                              rel="noopener"
                              href="mailto:UID@warblerlabs.com"
                            >
                              UID@warblerlabs.com
                            </Link>
                          </>
                        </p>
                      </>
                    </CallToActionBanner>
                  ) : status === "failed" ? (
                    <CallToActionBanner
                      renderButton={(props) => EmailUIDButton(props)}
                      colorScheme="red"
                      iconLeft="Exclamation"
                      title={
                        accreditationStatus === "failed"
                          ? "Accreditation check failed"
                          : identityStatus === "failed"
                          ? "Identity verification failed"
                          : "You are not eligible"
                      }
                      description="Sorry, you have been deemed ineligible for a UID."
                    />
                  ) : status === "approved" ? (
                    kycProvider === "persona" ||
                    (kycProvider === "parallelMarkets" &&
                      accreditationStatus === "approved") ? (
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
                      // unaccredited parallel markets case
                      <CallToActionBanner
                        renderButton={(props) => EmailUIDButton(props)}
                        colorScheme="red"
                        iconLeft="Exclamation"
                        title="We're sorry"
                        description={
                          type === "business"
                            ? countryCode === "US"
                              ? "Non-accredited US businesses are not eligible for UID"
                              : "You have selected the wrong KYC provider. Please contact us to proceed." // non-US business - should use persona
                            : "You have selected the wrong KYC provider. Please contact us to proceed." // US or non-US individual - should use persona
                        }
                      />
                    )
                  ) : (
                    // if status is unknown
                    <CallToActionBanner
                      renderButton={(props) => (
                        <Button {...props} onClick={openVerificationModal}>
                          Begin UID setup
                        </Button>
                      )}
                      iconLeft={DEFAULT_UID_ICON}
                      title="Setup your UID to start"
                      description={SETUP_UID_BANNER_TEXT}
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

function EmailUIDButton(
  props: Pick<ButtonProps, "className" | "size" | "variant" | "colorScheme">
) {
  return (
    <Button {...props} as="a" href="mailto:uid@warblerlabs.com">
      Email us
    </Button>
  );
}
