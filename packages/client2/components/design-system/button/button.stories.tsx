import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Button, IconButton } from ".";

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

// Putting <Button /> and <IconButton /> beside each other to prove their sizing is consistent
export const ButtonStory: ComponentStory<typeof Button> = (args) => (
  <div>
    <Button {...args} />{" "}
    <IconButton
      icon="ArrowSmRight"
      label="Placeholder"
      size={args.size}
      colorScheme={args.colorScheme}
      variant={args.variant}
      disabled={args.disabled}
    />
  </div>
);

ButtonStory.args = {
  children: "Hello World",
  size: "md",
  variant: "standard",
  colorScheme: "primary",
  disabled: false,
};
