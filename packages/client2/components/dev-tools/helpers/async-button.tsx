import { ReactNode } from "react";
import { useForm } from "react-hook-form";

import { Button, ButtonProps, Form, Tooltip } from "@/components/design-system";

type AsycButtonProps = ButtonProps & {
  onClick: () => Promise<unknown>;
  tooltip?: ReactNode;
};

export function AsyncButton({ onClick, tooltip, ...rest }: AsycButtonProps) {
  return (
    <Form rhfMethods={useForm()} onSubmit={onClick}>
      {tooltip ? (
        <Tooltip content={tooltip}>
          <Button type="submit" size="lg" {...rest} />
        </Tooltip>
      ) : (
        <Button type="submit" size="lg" {...rest} />
      )}
    </Form>
  );
}
