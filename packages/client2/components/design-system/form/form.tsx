import { ReactNode, FormHTMLAttributes, useEffect } from "react";
import { FormProvider } from "react-hook-form";
import { UseFormReturn, SubmitHandler } from "react-hook-form/dist/types/form";

import { HelperText } from "../typography";

type FormProps<FormFields> = Omit<
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
};

const reservedErrorField = "fallback";

export function Form<FormFields>({
  children,
  rhfMethods,
  onSubmit,
  className,
  onChange,
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
      // @ts-expect-error I'm not sure of a way to make TS accept this
      setError(reservedErrorField, { message: error.message });
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
        {/* @ts-expect-error Same as above */}
        {errors[reservedErrorField] ? (
          <HelperText className="mt-2">
            {/* @ts-expect-error Same as above */}
            Error: {errors[reservedErrorField].message}
          </HelperText>
        ) : null}
      </form>
    </FormProvider>
  );
}
