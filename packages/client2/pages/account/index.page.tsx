import { TabButton, TabGroup, TabList } from "@/components/design-system";
import { NextPageWithLayout } from "@/pages/_app.page";

const AccountsPage: NextPageWithLayout = () => {
  return (
    <div className="display: flex flex-col">
      <text className="font-serif text-5xl font-bold text-sand-800">
        Account
      </text>
      <TabGroup>
        <TabList>
          <TabButton>UID and Wallets</TabButton>
        </TabList>
      </TabGroup>
    </div>
  );
};

AccountsPage.layout = "mustard-background";

export default AccountsPage;
