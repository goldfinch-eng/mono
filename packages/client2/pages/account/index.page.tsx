import { useRouter } from "next/router";
import { useEffect } from "react";
import { ReactNode } from "react";

import {
  Button,
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
  confirmDialog,
} from "@/components/design-system";
import { CallToActionBanner } from "@/components/design-system";
import { PARALLEL_MARKETS } from "@/constants";
import { openVerificationModal, openWalletModal } from "@/lib/state/actions";
import { useWallet } from "@/lib/wallet";
import { NextPageWithLayout } from "@/pages/_app.page";

/* Will make the description conditional soon */
const CallToActionBannerDescription =
  "UID is a non-transferrable NFT representing KYC-verification on-chain. A UID is required to participate in the Goldfinch lending protocol. No personal information is stored on-chain.";

const confirmDialogBody = (text: string) => (
  <div>
    <div className="mb-2 text-xl font-bold">Error</div>
    <div>{text}</div>
  </div>
);

const AccountsPage: NextPageWithLayout = () => {
  const { account } = useWallet();
  const { query } = useRouter();

  useEffect(() => {
    /* Check for cross-site forgery on redirection to account page from parallel markets when page first renders */
    if (query.state != undefined) {
      const parallel_markets_state = sessionStorage.getItem(
        PARALLEL_MARKETS.STATE_KEY
      );
      if (parallel_markets_state !== query.state) {
        confirmDialog(
          confirmDialogBody(
            "Detected a possible cross-site request forgery attack on your Parallel Markets session. Please try authenticating with Parallel Markets through Goldfinch again."
          ),
          false /* include buttons */
        );
        return;
      }
    }
    if (query.error === "access_denied") {
      confirmDialog(
        confirmDialogBody(
          "You have declined to give Goldfinch consent for authorization to Parallel Markets."
        ),
        false /* include buttons */
      );
      return;
    }
  }, [query.state, query.error]);

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
                <CallToActionBanner
                  renderButton={(props) =>
                    account ? (
                      <Button {...props} onClick={openVerificationModal}>
                        Begin UID set up
                      </Button>
                    ) : (
                      <Button {...props} onClick={openWalletModal}>
                        Connect Wallet
                      </Button>
                    )
                  }
                  iconLeft="Globe"
                  title="Setup your UID to start" /* will make title conditional soon */
                  description={CallToActionBannerDescription}
                />
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
