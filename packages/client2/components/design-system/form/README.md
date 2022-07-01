# The `<Form>` component

This is a special component that works together with React Hook Form, creating a FormContext to confer a few benefits and enforce some good UI patterns:

- `<Input>` components within a `<Form>` will automatically read the form state to find their own error messages. You do not need to manually set the `errorMessage` prop on these instances
- `<Button type="submit">` components within a form will read the form state to disable themselves during submission and show a spinner.
- You don't need to wrap the form's submit handler in React Hook Form's `handleSubmit()`, the `<Form>` component does this for you. The `<Form>` component also automatically catches thrown errors in the submit handler and surfaces the error in the UI (at the bottom of the form), so you don't have to worry about unhandled errors being swallowed in the handler.
- Automatically resets the form after a successful submission
