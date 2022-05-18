import {assertNonNullable} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import {useEffect, useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import styled from "styled-components"
import {ERC20Metadata, toAtomicAmount} from "../../ethereum/erc20"
import useDebounce from "../../hooks/useDebounce"
import {displayNumber} from "../../utils"
import TransactionInput from "../transactionInput"

type StakingCardFormProps = {
  // Token to stake
  token: ERC20Metadata
  // Max amount available to stake (denominated in `token` decimals)
  maxAmountToStake: BigNumber
  // Max amount available to unstake (denominated in `token` decimals)
  maxAmountToUnstake: BigNumber
  // Optional migrate form. The "Migrate" tab will be displayed if this props exists.
  migrateForm?: React.ReactNode
  stake: (BigNumber) => Promise<any>
  unstake: (BigNumber) => Promise<any>
}

enum Tab {
  Stake = "Stake",
  Unstake = "Unstake",
  Migrate = "Migrate",
}

const Container = styled.div`
  display: flex;
`

const TabComponent = styled.button<{active: boolean}>`
  width: auto;
  font-weight: 500;
  font-size: 21px;
  padding-bottom: 8px;
  border-bottom: ${(props) => (props.active ? "2px solid #483e5e" : "none")};
  color: ${(props) => (props.active ? "inherit" : "#ABA39D")}
  margin-right: 40px;
  margin-bottom: 30px;
`

const StyledButton = styled.button<{small: boolean}>`
  font-size: ${({small}) => (small ? "20px" : "inherit")};
`

export default function StakingCardForm({
  token,
  maxAmountToUnstake,
  maxAmountToStake,
  stake,
  unstake,
  migrateForm,
}: StakingCardFormProps) {
  const formMethods = useForm()

  const [isPending, setIsPending] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Stake)
  const [amountToStakeInDecimals, setAmountToStakeInDecimals] = useState<BigNumber>(new BigNumber(0))
  const [amountToUnstakeInDecimals, setAmountToUnstakeInDecimals] = useState<BigNumber>(new BigNumber(0))
  const [shouldDisplayMigrateForm, setShouldDisplayMigrateForm] = useState(false)
  const [shouldUseMaxAmount, setShouldUseMaxAmount] = useState(false)

  const debouncedSetAmountToStakeInDecimals = useDebounce(setAmountToStakeInDecimals, 200)
  const debouncedSetAmountToUnstakeInDecimals = useDebounce(setAmountToUnstakeInDecimals, 200)

  useEffect(() => {
    // Display the migrate form only if the user has staked position(s) to migrate
    //
    // Note: Once the user has seen the migrate form in their current session, continue to display the migrate
    // tab even if they no longer have staked position(s) to migrate to avoid a confusing experience with
    // changing UI.
    if (!!migrateForm && !maxAmountToUnstake.isZero()) {
      setShouldDisplayMigrateForm(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrateForm])

  function onTabClick(tab: Tab) {
    if (tab !== activeTab) {
      setActiveTab(tab)
      debouncedSetAmountToUnstakeInDecimals(new BigNumber(0))
      debouncedSetAmountToStakeInDecimals(new BigNumber(0))
    }
  }

  function onChange({isMaxClick = false}: {isMaxClick?: boolean}) {
    switch (activeTab) {
      case Tab.Stake:
        const amountToStake: string = formMethods.getValues("amountToStake")
        debouncedSetAmountToStakeInDecimals(!!amountToStake ? new BigNumber(amountToStake) : new BigNumber(0))
        break
      case Tab.Unstake:
        const amountToUnstake: string = formMethods.getValues("amountToUnstake")
        debouncedSetAmountToUnstakeInDecimals(!!amountToUnstake ? new BigNumber(amountToUnstake) : new BigNumber(0))
        break
    }

    setShouldUseMaxAmount(isMaxClick)
  }

  function onMaxClick(formInputName: string, maxAmount: BigNumber) {
    formMethods.setValue(formInputName, maxAmount.decimalPlaces(6, 1).toString(10), {
      shouldValidate: true,
      shouldDirty: true,
    })
    onChange({isMaxClick: true})
  }

  function onSubmit(e) {
    setIsPending(true)

    switch (activeTab) {
      case Tab.Stake:
        // If the most recent value was set using the "Max" button, use the precise value of `maxAmountToStake`,
        // instead of the imprecise `amountToStakeInDecimals` to avoid any "dust" left behind.
        const atomicAmountToStake = shouldUseMaxAmount
          ? maxAmountToStake
          : toAtomicAmount(amountToStakeInDecimals, token.decimals)
        stake(atomicAmountToStake).then(onSubmitComplete)
        break
      case Tab.Unstake:
        // If the most recent value was set using the "Max" button, use the precise value of `maxAmountToUnstake`,
        // instead of the imprecise `amountToUnstakeInDecimals` to avoid any "dust" left behind.
        const atomicAmountToUnstake = shouldUseMaxAmount
          ? maxAmountToUnstake
          : toAtomicAmount(amountToUnstakeInDecimals, token.decimals)
        unstake(atomicAmountToUnstake).then(onSubmitComplete)
        break
    }
  }

  function onSubmitComplete() {
    setIsPending(false)

    // Clear form fields
    formMethods.reset()
    setAmountToStakeInDecimals(new BigNumber(0))
    setAmountToUnstakeInDecimals(new BigNumber(0))
  }

  return (
    <div>
      <Container>
        <TabComponent active={activeTab === Tab.Stake} onClick={() => onTabClick(Tab.Stake)}>
          {Tab.Stake.toString()}
        </TabComponent>
        <TabComponent active={activeTab === Tab.Unstake} onClick={() => onTabClick(Tab.Unstake)}>
          {Tab.Unstake.toString()}
        </TabComponent>
        {shouldDisplayMigrateForm && (
          <TabComponent active={activeTab === Tab.Migrate} onClick={() => onTabClick(Tab.Migrate)}>
            {Tab.Migrate.toString()}
          </TabComponent>
        )}
      </Container>
      {(() => {
        switch (activeTab) {
          case Tab.Stake:
          case Tab.Unstake:
            const amountForActiveTabInDecimals =
              activeTab === Tab.Stake ? amountToStakeInDecimals : amountToUnstakeInDecimals
            const maxAmountForActiveTabInDecimals =
              activeTab === Tab.Stake
                ? maxAmountToStake.div(new BigNumber(10).pow(token.decimals))
                : maxAmountToUnstake.div(new BigNumber(10).pow(token.decimals))
            const amountInputLabel = maxAmountForActiveTabInDecimals.isZero()
              ? "Amount"
              : `Amount (max: ${displayNumber(maxAmountForActiveTabInDecimals)} ${token.ticker})`
            const formInputName = activeTab === Tab.Stake ? "amountToStake" : "amountToUnstake"
            const hasSufficientBalance = maxAmountForActiveTabInDecimals.gte(amountForActiveTabInDecimals)

            return (
              <FormProvider {...formMethods}>
                <div>
                  <div className="form-input-label">{amountInputLabel}</div>
                  <div className="form-inputs-footer">
                    <TransactionInput
                      name={formInputName}
                      ticker={token.ticker}
                      displayTicker={true}
                      displayUSDCTicker={true}
                      formMethods={formMethods}
                      maxAmount={maxAmountForActiveTabInDecimals.toString(10)}
                      onChange={() => onChange({isMaxClick: false})}
                      rightDecoration={
                        <button
                          className="enter-max-amount"
                          disabled={maxAmountForActiveTabInDecimals.isZero()}
                          type="button"
                          onClick={() => onMaxClick(formInputName, maxAmountForActiveTabInDecimals)}
                        >
                          Max
                        </button>
                      }
                    />
                    <StyledButton
                      type="button"
                      disabled={amountForActiveTabInDecimals.isZero() || isPending || !hasSufficientBalance}
                      className="button submit-form"
                      onClick={onSubmit}
                      small={!hasSufficientBalance}
                    >
                      {hasSufficientBalance ? activeTab.toString() : "Insufficient balance"}
                    </StyledButton>
                  </div>
                </div>
              </FormProvider>
            )
          case Tab.Migrate:
            assertNonNullable(migrateForm)
            return migrateForm
        }
      })()}
    </div>
  )
}
