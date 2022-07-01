import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Chip } from "./index";

export default {
  title: "Components/Chip",
  component: Chip,
  argTypes: {
    children: {
      control: {
        type: "text",
      },
    },
  },
} as ComponentMeta<typeof Chip>;

export const ChipStory: ComponentStory<typeof Chip> = (args) => {
  return <Chip {...args} />;
};

ChipStory.args = {
  children: "It's chippy!",
  colorScheme: "white",
};
