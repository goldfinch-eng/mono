# Goldfinch Smart Contract Overview
This is meant to be a high level summary of the Goldfinch Protocol, including the responsibilities and intent of each smart contract. This does not get into every function or parameter, just the basics of what's going on.

## How It All Fits Together
There are a few "roles" in the protocol. They are as follows.
- `LiquidityProvider` (a.k.a. LP's) - These are the people or entities who fund the `Pool` (see below), and therefore the loans we make.
- `Underwriter` - These are the entities who have been trusted to determine if a given borrower is creditworthy. If so, they create a `CreditLine` for that particular borrower (which includes their interest rate, credit limit, and so forth).
- `Borrower` - These are the people or entities who actually drawdown from the pool of capital.
- `Admin DAO` - This is generally the "owner" of the smart contracts. In the medium term, this will be a community owned multi-sig wallet which can take important actions such as giving (or taking) an arbitrary limit to underwriters, pausing contracts, etc.


### Technical Overview
These roles interact through two "main" smart contracts. Each of which have public API's that we expect our users to directly interact with through the front-ends we provide.
- `CreditDesk` - Front-facing "borrower side". Handles all borrowing and repayment requests.
  - `CreditLine` (contract) - "Dumb" state container, used by the `CreditDesk` for credit status of a particular borrower. Can be publicly called to query state, but does not perform any logic.
  - `Accountant` (library) - Contains core calculation logic for determining payment amounts, interest and principal accrued, etc.

- `Pool` - Front-facing, handles deposit and withdrawl functions on the LP side.

## The Contracts

### CreditDesk
This is the most complex contract. It is the main entry contract for borrowers, and underwriters. It also contains several key admin functions. Let's discuss the responsibilities for each of those users.

- Borrowers: Provide a central place to borrow, repay, and determine your status and upcoming payments. The main functions here are:
  - `drawdown`
  - `pay`

- Underwriters: Provide a way to create and manage credit lines for borrowers
  - `createCreditLine`

- Admins: Provide a way to manage underwriters, and assess all creditlines.
  - `setUnderwriterGovernanceLimit`
  - `asessCreditLine`

### Pool
The `Pool` is the entry point for LP's. It also "handles the money", in so far as it actually does the transferring of tokens when users deposit, withdraw, or when we receive repayments from borrowers. Note the funds are handled through an ERC20 contract. For the pilot we will only be using USDC. It's key public functions are:

- `deposit`
- `withdraw`

### CreditLine
The `CreditLine` represents an agreement between the `Underwriter` and the `Borrower`. It contains things like the `limit`, `interestApr`, `paymentPeriodInDays`, and other key info. It is meant to be a "dumb" state container, fully managed by the `CreditDesk`, and indeed it currently contains no business logic. It's only functions are simple getters and setters for it's state. The setters can only be called by it's owner, which is the `CreditDesk`. It has no publicly functions that change state.

### Accountant
This is an in-house library for handling core financial calculations. The two methods actually used outside the library (essentially the public API) are:

- `calculateInterestAndPrincipalAccrued`
- `allocatePayment`

### GoldfinchConfig
A central contract for storing key numbers and addresses of the protocol. For example, we store the TransactionLimit, and the Pool's deployed address there.

### Fidu
An ERC20 "liquidity token", analogous to cToken's in Compound. Fidu is minted and burned on deposit and withdraw, respectively. It simply represents an LP's share of the pool.