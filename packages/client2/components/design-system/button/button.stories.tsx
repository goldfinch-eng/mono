import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Button } from ".";

export default {
  title: "Components/Button",
  component: Button,
  argTypes: {
    children: {
      control: {
        type: "text",
      },
    },
  },
  parameters: {
    controls: { expanded: true },
  },
} as ComponentMeta<typeof Button>;

export const ButtonStory: ComponentStory<typeof Button> = (args) => (
  <Button {...args} />
);

ButtonStory.args = {
  children: "Hello World",
  size: "md",
  variant: "standard",
  colorScheme: "primary",
  disabled: false,
};
