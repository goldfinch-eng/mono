import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import {
  Button,
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
import { useWallet } from "@/lib/wallet";
import { NextPageWithLayout } from "@/pages/_app.page";

const AccountsPage: NextPageWithLayout = () => {
  const { account, provider, signer } = useWallet();
  const { query } = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    const asyncEffect = async () => {
      setError(undefined);
      try {
        if (query.code) {
          setIsLoading(true);
        }
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
          await registerKyc(account, sig);
        }
      } catch (e) {
        setError(e as Error);
      } finally {
        setIsLoading(false);
      }
    };
    asyncEffect();
  }, [query.state, query.error, query.code, account, provider, signer]);

  useEffect(() => {
    /* handle KYC Status request */
  }, []);

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
                    iconLeft={error ? "Exclamation" : "Globe"}
                    title={
                      error
                        ? "There was a problem connecting to our verification partner"
                        : "Setup your UID to start"
                    } /* will make title conditional soon */
                    description={
                      error
                        ? error.message
                        : "UID is a non-transferrable NFT representing KYC-verification on-chain. A UID is required to participate in the Goldfinch lending protocol. No personal information is stored on-chain."
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
