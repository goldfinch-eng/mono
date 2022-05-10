import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Breadcrumb } from "./index";

export default {
  title: "Components/Breadcrumb",
  component: Breadcrumb,
  argTypes: {
    image: {
      control: {
        type: "text",
      },
    },
    label: {
      control: {
        type: "text",
      },
    },
    link: {
      control: {
        type: "text",
      },
    },
  },
} as ComponentMeta<typeof Breadcrumb>;

export const BreadcrumbStory: ComponentStory<typeof Breadcrumb> = (args) => {
  return <Breadcrumb {...args} />;
};

BreadcrumbStory.args = {
  image:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAdUlEQVR42mNgGAWjAAj+48GUG37i92+cmFJL/hMDKLHkv1TeVYKYIgvwBQ81gommFvxHtqB0797/6BbCxMixAGzA7AcPUFyJzEcWI9sHxAQP1YIIGWPzCVUjeehbQLN8gK2wG1o+oElpSiiIqFoXUKuCoboFAP+MJG7jSOWlAAAAAElFTkSuQmCC",
  label: "Goldfinch",
  link: "https://goldfinch.finance/",
};
