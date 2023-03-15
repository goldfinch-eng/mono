import clsx from "clsx";
import {
  Children,
  createContext,
  CSSProperties,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { FieldValues, Path } from "react-hook-form";

import { Button, ButtonProps } from "../button";
import { Form, FormProps } from "../form";
import { Sentinel } from "../sentinel";
import { Modal, ModalProps } from "./modal";

interface StepperProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalStepper({
  children,
  ...modalProps
}: StepperProps & Omit<ModalProps, "children" | "layout">) {
  return (
    <Modal {...modalProps} layout="custom">
      <Stepper isOpen={modalProps.isOpen} onClose={modalProps.onClose}>
        {children}
      </Stepper>
    </Modal>
  );
}

interface StepperContextInterface {
  isOpen: boolean;
  onClose: () => void;
  numSteps: number;
  step: number;
  setStep: (n: number) => void;
  incrementStep: () => void;
  decrementStep: () => void;
  data: FieldValues;
  setData: (d: FieldValues) => void;
  /**
   * INTERNAL USE ONLY
   */
  formFieldMemory: FieldValues;
  /**
   * INTERNAL USE ONLY
   */
  setFormFieldMemory: (f: FieldValues) => void;
  didScrollBottom: boolean;
  setDidScrollBottom: (b: boolean) => void;
}

const noop = () => undefined;
const Context = createContext<StepperContextInterface>({
  isOpen: false,
  onClose: noop,
  numSteps: 0,
  step: 0,
  setStep: noop,
  incrementStep: noop,
  decrementStep: noop,
  data: {},
  setData: noop,
  formFieldMemory: {},
  setFormFieldMemory: noop,
  didScrollBottom: false,
  setDidScrollBottom: noop,
});

export function useStepperContext() {
  return useContext(Context);
}

function Stepper({ children, isOpen, onClose }: StepperProps) {
  const numSteps = Children.count(children);
  const [data, setData] = useState<StepperContextInterface["data"]>({});
  const [step, setStep] = useState(0);
  const firstStep = 0;
  const finalStep = numSteps - 1;

  const incrementStep = () => setStep((s) => Math.min(finalStep, s + 1));
  const decrementStep = () => setStep((s) => Math.max(firstStep, s - 1));

  const [didScrollBottom, setDidScrollBottom] = useState(false);

  const [formFieldMemory, setFormFieldMemory] = useState<FieldValues>({});

  return (
    <Context.Provider
      value={{
        isOpen,
        onClose,
        numSteps,
        step,
        data,
        setData,
        formFieldMemory,
        setFormFieldMemory,
        setStep,
        incrementStep,
        decrementStep,
        didScrollBottom,
        setDidScrollBottom,
      }}
    >
      {Children.map(children, (child, index) =>
        index === step ? child : null
      )}
    </Context.Provider>
  );
}

interface StepButtonProps extends ButtonProps {
  children?: string;
  direction: "previous" | "next";
  customBehaviour?: boolean;
}

export function StepperButton({
  children,
  direction,
  customBehaviour = false,
  ...rest
}: StepButtonProps) {
  const { onClose, step, incrementStep, decrementStep } = useStepperContext();
  const isFirstStep = step === 0;
  return (
    <Button
      colorScheme={direction === "previous" ? "secondary" : "primary"}
      onClick={
        customBehaviour
          ? undefined
          : direction === "previous"
          ? isFirstStep
            ? onClose
            : decrementStep
          : incrementStep
      }
      type="button"
      {...rest}
    >
      {children
        ? children
        : direction === "previous"
        ? isFirstStep
          ? "Close"
          : "Back"
        : "Next"}
    </Button>
  );
}

export function StepperFooter({
  left = <StepperButton direction="previous" />,
  right = <StepperButton direction="next" />,
  className,
  style,
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { step, numSteps } = useStepperContext();
  return (
    <div
      className={clsx(
        "item-center flex basis-0 items-center justify-between border-t border-sand-200 px-6 pt-4",
        className
      )}
      style={style}
    >
      {left}
      <div className="text-xs text-sand-500">
        {step + 1} of {numSteps}
      </div>
      {right}
    </div>
  );
}

export function Step({
  children,
  className,
  nextButton,
}: {
  children: ReactNode;
  className?: string;
  nextButton?: ReactNode;
}) {
  const { setDidScrollBottom } = useStepperContext();

  // This is intentionally initialized to undefined. Let the <Sentinel> run for a frame to figure out if it really is not visible
  const [isBottomVisible, setIsBottomVisible] = useState<boolean>();
  useEffect(() => {
    if (isBottomVisible) {
      setDidScrollBottom(true);
    }
  }, [isBottomVisible, setDidScrollBottom]);

  useEffect(() => {
    setDidScrollBottom(false);
  }, [setDidScrollBottom]);

  return (
    <div>
      <div className={clsx("h-[75vh] overflow-auto", className)}>
        <div className="px-6 pt-4 pb-1">
          {children}
          <Sentinel onVisibilityChange={setIsBottomVisible} />
        </div>
      </div>
      <StepperFooter
        right={nextButton}
        style={{
          boxShadow:
            isBottomVisible === false // Intentionally checking strict boolean equality. Want `undefined` to show no shadow, or else you get an ugly flicker when the Sentinel is already visible.
              ? "0px -10px 20px 0px rgba(0,0,0,0.15)"
              : "none",
          clipPath: "inset(-30px 0px 0px 0px)",
        }}
        className="transition-shadow"
      />
    </div>
  );
}

interface FromStepProps<T extends FieldValues> {
  /**
   * The default onSubmit behaviour of <FormStep /> is to append the form's data to the `data` object. If you define this function, that default behaviour will be replaced.
   */
  onSubmit?: FormProps<T>["onSubmit"];
  rhfMethods: FormProps<T>["rhfMethods"];
  children: ReactNode;
  className?: string;
  submitButtonLabel?: string;
  requireScrolled?: boolean;
}

export function FormStep<T extends FieldValues>({
  children,
  className,
  onSubmit,
  rhfMethods,
  submitButtonLabel,
  requireScrolled = false,
}: FromStepProps<T>) {
  const {
    data,
    setData,
    formFieldMemory,
    setFormFieldMemory,
    incrementStep,
    step,
    numSteps,
    onClose,
    didScrollBottom,
  } = useStepperContext();

  useEffect(
    function restoreFieldMemory() {
      for (const [fieldName, fieldValue] of Object.entries(formFieldMemory)) {
        rhfMethods.setValue(fieldName as Path<T>, fieldValue);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Form
      rhfMethods={rhfMethods}
      onSubmit={async (submittedData) => {
        if (onSubmit) {
          await onSubmit(submittedData);
        } else {
          setData({ ...data, ...submittedData });
        }

        setFormFieldMemory({ ...formFieldMemory, ...submittedData });
        if (step === numSteps - 1) {
          onClose();
        } else {
          incrementStep();
        }
      }}
      genericErrorClassName="ml-6"
      persistAfterSubmit
    >
      <Step
        className={className}
        nextButton={
          <StepperButton
            direction="next"
            type="submit"
            disabled={requireScrolled && !didScrollBottom ? true : undefined}
            customBehaviour
          >
            {submitButtonLabel ?? step === numSteps - 1 ? "Submit" : undefined}
          </StepperButton>
        }
      >
        {children}
      </Step>
    </Form>
  );
}
