# Callable Credit Line

- Loan state looks weird becuase it's just three states
  - FundingPeriod
  - DrawdownPeriod
  - InProgress
- My gripes with this are
  - It is incomplete, e.g. missing a End state period
  - It can be further broken down, e.g. InProgress -> (OnTime, Late)
- Since there's no end state I'm going to look at what actions can be performed
  when the loan is in progress but really shouldn't be able to be performed because
  the loan has actually ended
  - You can call _pay_ while loan state is in progress. I wonder what happens when
    you call pay after the loan is paid back (balance == 0)
    - It works, because it only takes amounts owed, so any excess payment is never 
      transferred to the user
  - Looks like you can call submitCall when loan state is in progress. What if the
    loan is fully paid back and we submit a call?