import { ComponentMeta, ComponentStory } from "@storybook/react";
import { useForm } from "react-hook-form";

import { Input, DollarInput } from ".";

export default {
  component: Input,
  title: "Components/Input",
} as ComponentMeta<typeof Input>;

export const InputStory: ComponentStory<typeof Input> = (args) => (
  <Input {...args} />
);

InputStory.args = {
  label: "Name",
  placeholder: "John Doe",
  colorScheme: "light",
  textSize: "md",
};

export const DollarInputStory: ComponentStory<typeof DollarInput> = (args) => {
  const { control, setValue, handleSubmit } = useForm<{ amount: string }>();
  return (
    <form onSubmit={handleSubmit((data) => alert(`Amount: ${data.amount}`))}>
      <div className="mb-4">
        It is important to keep in mind that the DollarInput component is an
        adapted controlled input, and as such it can only be used alongside
        React Hook Form, not by itself. This is considered a best-practice for
        input elements in this project regardless.
      </div>
      <DollarInput
        control={control}
        onMaxClick={() => setValue("amount", "1000000")}
        {...args}
      />
      <button type="submit">Submit</button>
    </form>
  );
};

DollarInputStory.args = {
  label: "Dollar amount",
  name: "amount",
};
