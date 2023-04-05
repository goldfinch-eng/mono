import {
  TabButton,
  TabContent,
  TabGroup,
  TabList,
  TabPanels,
} from "@/components/design-system";
import { CallToAction } from "@/components/design-system/call-to-action";
import { NextPageWithLayout } from "@/pages/_app.page";

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
                {
                  <CallToAction
                    iconLeft="Globe"
                    title="Setup your UID to start"
                    buttonRight={}
                  />
                }
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
