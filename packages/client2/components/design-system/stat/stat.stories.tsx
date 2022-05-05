import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Stat } from "./index";

export default {
  title: "Components/Stat",
  component: Stat,
  argTypes: {
    label: {
      control: {
        type: "text",
      },
    },
    value: {
      control: {
        type: "text",
      },
    },
    tooltip: {
      control: {
        type: "text",
      },
    },
  },
} as ComponentMeta<typeof Stat>;

export const StatStory: ComponentStory<typeof Stat> = (args) => {
  return <Stat {...args} />;
};

StatStory.args = {
  label: "Stat heading",
  value: "$15,000.00",
  tooltip: "Optional tooltip text or component",
};
