import * as Sentry from "@sentry/nextjs";
import clsx from "clsx";
import { ReactNode, FormHTMLAttributes, useEffect } from "react";
import { FieldValues, FormProvider } from "react-hook-form";
import { UseFormReturn, SubmitHandler } from "react-hook-form/dist/types/form";

import { HelperText } from "../typography";

export type FormProps<FormFields extends FieldValues> = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  children: ReactNode;
  /**
   * This supposed to be the result of calling useForm() in its entirety
   */
  rhfMethods: UseFormReturn<FormFields>;
  onSubmit: SubmitHandler<FormFields>;
  className?: string;
  /**
   * Sets a classname for the generic error message. Helps styling in a pinch.
   */
  genericErrorClassName?: string;
};

const reservedErrorField = "fallback";

export function Form<FormFields extends FieldValues>({
  children,
  rhfMethods,
  onSubmit,
  className,
  onChange,
  genericErrorClassName,
  ...rest
}: FormProps<FormFields>) {
  const {
    handleSubmit,
    setError,
    formState: { errors, isSubmitSuccessful },
    clearErrors,
    reset,
  } = rhfMethods;

  const wrappedSubmitHandler = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      const message = (error as Error).message;
      // No need to show this on-screen, user knows what they did
      if (message.includes("User denied transaction signature")) {
        return;
      }
      // @ts-expect-error I'm not sure of a way to make TS accept this
      setError(reservedErrorField, { message });

      Sentry.captureException(
        new Error(`Caught form submission error: ${message}`)
      );
    }
  });

  useEffect(() => {
    if (isSubmitSuccessful) {
      reset();
    }
  }, [isSubmitSuccessful, reset]);

  return (
    <FormProvider {...rhfMethods}>
      <form
        {...rest}
        onChange={(e) => {
          // @ts-expect-error Same as above
          clearErrors(reservedErrorField);
          onChange?.(e);
        }}
        className={className}
        onSubmit={wrappedSubmitHandler}
      >
        {children}
        {errors[reservedErrorField] ? (
          <HelperText
            className={clsx("mt-2 text-clay-500", genericErrorClassName)}
          >
            {errors[reservedErrorField].message}
          </HelperText>
        ) : null}
      </form>
    </FormProvider>
  );
}
