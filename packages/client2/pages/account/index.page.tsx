import clsx from "clsx";
import { useRouter } from "next/router";
import { ReactNode, useEffect, useState } from "react";

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
import { openVerificationModal, openWalletModal } from "@/lib/state/actions";
import { getSignatureForKyc, registerKyc } from "@/lib/verify";
import { fetchKycStatus } from "@/lib/verify";
import { KycSignature } from "@/lib/verify";
import { useWallet } from "@/lib/wallet";
import { NextPageWithLayout } from "@/pages/_app.page";

const DEFAULT_UID_SET_UP_STRING =
  "UID is a non-transferrable NFT representing KYC-verification on-chain. A UID is required to participate in the Goldfinch lending protocol. No personal information is stored on-chain.";
const DEFAULT_UID_TITLE = "Setup your UID to start";
const DEFAULT_UID_ICON = "Globe";

const AccountsPage: NextPageWithLayout = () => {
  const { account, provider, signer } = useWallet();
  const { query } = useRouter();
  const [identityStatus, setIdentityStatus] = useState<string>(
    "pending_verification"
  );
  const [accreditationStatus, setAccreditationStatus] = useState<string>(
    "pending_verification"
  );
  const [status, setStatus] = useState<string>("unknown");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    const asyncEffect = async () => {
      if (query.code) {
        setIsLoading(true);
      }
      setError(undefined);
      /* we don't want to keep asking users for their signature once they've already signed */
      try {
        /* Check for cross-site forgery on redirection to account page from parallel markets when page first renders */
        if (query.state !== undefined) {
          const parallel_markets_state = sessionStorage.getItem(
            PARALLEL_MARKETS.STATE_KEY
          );
          if (query.state !== parallel_markets_state) {
            throw new Error(
              "Detected a possible cross-site request forgery attack on your Parallel Markets session. Please try authenticating with Parallel Markets through Goldfinch again."
            );
          }
        }
        if (query.error === "access_denied") {
          throw new Error(
            "You have declined to give Goldfinch consent for authorization to Parallel Markets. Please try authenticating with Parallel Markets through Goldfinch again."
          );
        }
        if (query.code !== undefined && account && provider && signer) {
          const sig = await getSignatureForKyc(
            provider,
            signer,
            JSON.stringify({ key: query.code, provider: "parallel_markets" })
          );
          const response = await registerKyc(account, sig);
          localStorage.setItem("registerKyc", response.ok.toString());
        }
      } catch (e) {
        setError(e as Error);
      } finally {
        if (localStorage.getItem("registerKyc") === "true") {
          setIsLoading(false);
        }
      }
    };
    asyncEffect();
  }, [query.state, query.error, query.code, account, provider, signer]);

  useEffect(() => {
    const asyncEffect = async () => {
      if (localStorage.getItem("registerKyc") === "true") {
        setIsLoading(true);
      }
      try {
        /* if a user has already signed we can trigger the next async action (fetching updated KYC status) */
        const signature = sessionStorage.getItem("signature");
        if (signature == null) {
          throw new Error(
            "We don't have your signature. Please re-try the process again."
          );
        }
        const parsedSignature: KycSignature = JSON.parse(signature);
        if (account) {
          const kycStatus = await fetchKycStatus(account, parsedSignature);
          setIdentityStatus(kycStatus.identityStatus);
          setAccreditationStatus(kycStatus.accreditationStatus);
          setStatus(kycStatus.status);
        }
      } catch (e) {
        setError(e as Error);
      } finally {
        setIsLoading(false);
      }
    };
    asyncEffect();
  }, [account, identityStatus, query.code]);

  const showPendingVerificationBanner = status === "pending" && account;
  const identityVerificationApproved = identityStatus === "approved";
  const accreditationVerificationApproved = accreditationStatus === "approved";

  const statuses: ReactNode = (
    <div className="full-width mt-8 flex flex-col gap-2 sm:flex-row">
      <div className="box-content flex flex-row rounded-md bg-mint-100 p-4 text-sm sm:w-1/3">
        <Icon className="mt-1 mr-1 fill-mint-450" name="Checkmark" />
        Documents Uploaded
      </div>
      <div
        className={clsx(
          "box-content flex flex-row rounded-md p-4 text-sm sm:w-1/3",
          identityVerificationApproved ? "bg-mint-100" : "bg-sand-100"
        )}
      >
        <Icon
          className={clsx(
            "mt-1 mr-1",
            identityVerificationApproved ? "fill-mint-450" : "fill-sand-300"
          )}
          name="Checkmark"
        />
        Identity verification
      </div>
      <div
        className={clsx(
          "box-content flex flex-row rounded-md p-4 text-sm sm:w-1/3",
          accreditationVerificationApproved ? "bg-mint-100" : "bg-sand-100"
        )}
      >
        <Icon
          className={clsx(
            "mt-1 mr-1",
            accreditationVerificationApproved
              ? "fill-mint-450"
              : "fill-sand-300"
          )}
          name="Checkmark"
        />
        Accreditation verification
      </div>
    </div>
  );

  /* After clicking on openVerificationModal, need to clear the URL */
  return (
    <div>
      <div className="bg-mustard-100">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <h1 className="font-serif text-5xl font-bold text-sand-800">
            Account
          </h1>
        </div>
      </div>
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
                {isLoading ? (
                  <Spinner size="lg" />
                ) : showPendingVerificationBanner ? (
                  <CallToActionBanner
                    iconLeft={DEFAULT_UID_ICON}
                    title="UID is being verified"
                    description="Almost there. Your UID is still being verified, please come back later."
                    colorScheme="white"
                    // eslint-disable-next-line react/no-children-prop
                    children={statuses}
                  />
                ) : (
                  <CallToActionBanner
                    renderButton={(props) =>
                      account ? (
                        <Button {...props} onClick={openVerificationModal}>
                          {error ? "Try again" : "Begin UID setup"}
                        </Button>
                      ) : (
                        <Button {...props} onClick={openWalletModal}>
                          Connect Wallet
                        </Button>
                      )
                    }
                    iconLeft={
                      account
                        ? error
                          ? "Exclamation"
                          : DEFAULT_UID_ICON
                        : DEFAULT_UID_ICON
                    }
                    title={
                      account
                        ? error
                          ? "There was a problem connecting to our verification partner"
                          : DEFAULT_UID_TITLE
                        : DEFAULT_UID_TITLE
                    }
                    description={
                      account
                        ? error
                          ? error.message
                          : DEFAULT_UID_SET_UP_STRING
                        : DEFAULT_UID_SET_UP_STRING
                    }
                  />
                )}
              </TabContent>
            </TabPanels>
          </div>
        </div>
      </TabGroup>
    </div>
  );
};

AccountsPage.layout = "naked";

export default AccountsPage;
