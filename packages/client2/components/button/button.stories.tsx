import { Story, Meta } from "@storybook/react";
import React from "react";

import { Button, ButtonProps } from "./index";

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
} as Meta;

export const ButtonStory: Story<ButtonProps> = (args) => <Button {...args} />;

ButtonStory.args = {
  children: "Hello World",
  size: "md",
  variant: "solid",
};
