import { ComponentStory, ComponentMeta } from "@storybook/react";

import { TabButton, TabContent, TabGroup, TabList, TabPanels } from "./tabs";

export default {
  title: "Components/Tabs",
  component: TabGroup,
} as ComponentMeta<typeof TabGroup>;

export const StatStory: ComponentStory<typeof TabGroup> = () => {
  return (
    <TabGroup>
      <TabList>
        <TabButton>Tab 1</TabButton>
        <TabButton>Tab 2</TabButton>
        <TabButton>Tab 3</TabButton>
      </TabList>
      <TabPanels>
        <TabContent>Content 1</TabContent>
        <TabContent>Content 2</TabContent>
        <TabContent>Content 3</TabContent>
      </TabPanels>
    </TabGroup>
  );
};
