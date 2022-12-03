import { useForm } from "react-hook-form";

import { Button, ButtonProps, Form } from "@/components/design-system";

type AsycButtonProps = ButtonProps & {
  onClick: () => Promise<void>;
};

export function AsyncButton({ onClick, ...rest }: AsycButtonProps) {
  return (
    <Form rhfMethods={useForm()} onSubmit={onClick}>
      <Button type="submit" size="lg" {...rest} />
    </Form>
  );
}
