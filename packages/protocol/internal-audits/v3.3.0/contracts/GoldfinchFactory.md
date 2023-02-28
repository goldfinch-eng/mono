# GoldfinchFactory
Audit of the Goldfinch Factory contract

- _createCallableLoan_
  - 🟢 For `onlyAdminOrBorrower`, consider creating a distinct role instead of reusing the
    BORROWER_ROLE