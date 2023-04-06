import {
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system";
import { CallToActionBanner } from "@/components/design-system";
import { CallToActionBannerButtonProps } from "@/components/design-system/call-to-action";
import { NextPageWithLayout } from "@/pages/_app.page";

const CallToActionBannerAccountPageButtonProps: CallToActionBannerButtonProps =
  {
    onClick: () => {
      /* to be filled out soon */
    },
    /**
     * Will make the name conditional soon
     */
    name: "Begin UID set up",
  };

/* Will make the description conditional soon */
const CallToActionBannerDescription =
  "UID is a non-transferrable NFT representing KYC-verification on-chain. A UID is required to participate in Goldfinch lending protocols. No personal information is stored on-chain.";

const AccountsPage: NextPageWithLayout = () => {
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
                  buttonRight={CallToActionBannerAccountPageButtonProps}
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
