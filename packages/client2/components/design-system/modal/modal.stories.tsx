import { Meta, Story } from "@storybook/react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";

import { Button, Input } from "@/components/design-system";

import { confirmDialog } from "./confirm-dialog";
import {
  Modal,
  ModalProps,
  ModalStepper,
  FormStep,
  useStepperContext,
  useModalContext,
} from "./index";

export default {
  component: Modal,
  title: "Components/Modal",
} as Meta;

export const ModalStory: Story<ModalProps> = (args) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div style={{ height: "2000px" }}>
      <Button onClick={() => setIsModalOpen(!isModalOpen)}>Open Modal</Button>
      <br />
      <div>this frame should lock scrolling while the modal is open</div>
      <Modal
        {...args}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      >
        <p>
          This is the main body of the modal. You put your content here. This is
          scrollable if it fills up.
        </p>
        <a href="#">This is a link inside the body</a>
        <p>
          Bacon ipsum dolor amet capicola sirloin cupim, sausage doner filet
          mignon beef leberkas kielbasa turkey tenderloin andouille tri-tip
          salami flank. Jerky turducken turkey burgdoggen, alcatra jowl bresaola
          salami short ribs pork belly rump cupim ground round tri-tip.
          Drumstick tail cupim short ribs leberkas tongue landjaeger corned beef
          ribeye short loin kevin chislic jowl. Tongue pork chop drumstick, pig
          cupim kielbasa shankle t-bone chislic ham hock hamburger andouille
          leberkas turducken tenderloin. Capicola porchetta tongue spare ribs
          brisket frankfurter alcatra salami t-bone pastrami strip steak
          pancetta. Landjaeger leberkas chislic, sirloin bacon swine turducken
          ham frankfurter pork chop biltong hamburger. Buffalo flank shoulder
          chislic meatloaf rump picanha spare ribs shank pig ball tip burgdoggen
          venison fatback capicola. Pig jerky frankfurter, rump corned beef
          pancetta short loin picanha beef. Cow sausage ball tip andouille,
          chuck pork belly burgdoggen frankfurter salami turducken. Capicola
          venison chicken tongue, chuck shoulder porchetta meatloaf prosciutto
          doner strip steak shankle brisket. Brisket alcatra landjaeger sausage.
          Alcatra shoulder corned beef kielbasa ball tip ham hock meatball tail
          landjaeger strip steak t-bone jerky buffalo bresaola. Chislic kevin
          sirloin beef ribs swine capicola pork. Filet mignon jerky turkey
          t-bone picanha biltong. Shankle chicken pork belly pastrami cupim
          corned beef pig. Meatball jerky frankfurter pastrami picanha swine
          tail andouille biltong boudin. Prosciutto brisket porchetta burgdoggen
          buffalo picanha. Drumstick bacon hamburger jowl beef ribs chuck
          brisket short loin turkey, venison alcatra shoulder tail. Fatback
          cupim ham hock pork belly. Chuck picanha cow, capicola fatback alcatra
          jerky chicken landjaeger pastrami. Capicola alcatra pastrami, ground
          round hamburger chicken picanha. Meatloaf tail brisket bresaola
          landjaeger kevin corned beef beef tenderloin turducken drumstick.
          T-bone tenderloin pork loin, andouille picanha capicola ground round
          flank. Short loin tri-tip sausage, buffalo ball tip filet mignon
          leberkas venison brisket. Capicola shank pancetta sausage, spare ribs
          tail filet mignon hamburger chuck turducken venison t-bone landjaeger.
          Tri-tip doner pig, landjaeger hamburger frankfurter cow boudin spare
          ribs chislic alcatra meatball beef short ribs. Turducken pork tail
          short loin.
        </p>
      </Modal>
    </div>
  );
};

ModalStory.args = {
  size: "md",
  title: "This the modal's heading",
  description: "This is the modal's description (optional)",
};

export const ConfirmDialogStory = () => {
  const handleClick = async () => {
    const confirmationResult = await confirmDialog("Do you accept?");
    // eslint-disable-next-line no-console
    console.log({ confirmationResult });
  };
  return (
    <div>
      <div>
        Demonstrates the use of an imperative function that allows you to invoke
        a confirm dialog and await the user&apos;s response. Use this in a
        pinch.
      </div>
      <div>
        The handler of this button asynchronously waits for you to interact with
        the confirm dialog, then logs your choice to the console.
      </div>
      <button type="button" onClick={handleClick}>
        Click me
      </button>
    </div>
  );
};

export const ModalStepperStory = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open stepper</Button>
      <ModalStepper
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Register your dog"
      >
        <StepOne />
        <StepTwo />
        <StepThree />
      </ModalStepper>
    </div>
  );
};

function StepOne() {
  const rhfMethods = useForm<{ dogName: string }>();
  const { register } = rhfMethods;
  const onSubmit = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const { useModalTitle } = useModalContext();
  useModalTitle("Step One");
  return (
    <FormStep rhfMethods={rhfMethods} onSubmit={onSubmit}>
      <div>Step One</div>
      <Input
        label="Dog Name"
        {...register("dogName", {
          required: "You must provide a name for your dog",
        })}
      />
    </FormStep>
  );
}

function StepTwo() {
  const rhfMethods = useForm<{ dogBreed: string }>();
  const { register } = rhfMethods;
  return (
    <FormStep rhfMethods={rhfMethods} requireScrolled>
      <div>Step Two</div>
      <div>You must scroll to the bottom of this step to proceed</div>
      <Input
        label="Dog Breed"
        {...register("dogBreed", {
          required: "Must provide a breed for your dog",
        })}
      />
      <div style={{ height: "1000px" }} />
    </FormStep>
  );
}

function StepThree() {
  const rhfMethods = useForm();
  const { data } = useStepperContext();
  const { useModalTitle } = useModalContext();
  useModalTitle("Step Three");
  return (
    <FormStep
      rhfMethods={rhfMethods}
      onSubmit={async () =>
        alert(`Stitched data from each step: ${JSON.stringify(data)}`)
      }
    >
      <div>Review</div>
      <div>Name: {data.dogName}</div>
      <div>Breed: {data.dogBreed}</div>
    </FormStep>
  );
}
