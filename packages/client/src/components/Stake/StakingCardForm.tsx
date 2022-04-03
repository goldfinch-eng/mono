import BigNumber from "bignumber.js"
import {useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"
import useDebounce from "../../hooks/useDebounce"
import {assertNonNullable, displayNumber} from "../../utils"
import TransactionInput from "../transactionInput"

type StakingCardFormProps = {
  token: ERC20Metadata
  maxAmountToStake: BigNumber
  maxAmountToUnstake: BigNumber
  stake: (BigNumber) => Promise<any>
  unstake: (BigNumber) => Promise<any>
  migrate?: (BigNumber) => Promise<any>
}

enum Tab {
  Stake = "Stake",
  Unstake = "Unstake",
  Migrate = "Migrate",
}

const Container = styled.div`
  display: flex;
`

const TabComponent = styled.div<{active: boolean}>`
  font-weight: 500;
  font-size: 21px;
  padding-bottom: 8px;
  border-bottom: ${(props) => (props.active ? "2px solid #483e5e" : "none")};
  color: ${(props) => (props.active ? "inherit" : "#ABA39D")}
  cursor: pointer;
  margin-right: 40px;
  margin-bottom: 30px;
`

export default function StakingCardForm({
  token,
  maxAmountToUnstake,
  maxAmountToStake,
  stake,
  unstake,
  migrate,
}: StakingCardFormProps) {
  const formMethods = useForm()

  const [activeTab, setActiveTab] = useState<Tab>(Tab.Stake)
  const [amountToStake, setAmountToStake] = useState(0)
  const [amountToUnstake, setAmountToUnstake] = useState(0)
  const [amountToMigrate, setAmountToMigrate] = useState(0)

  const debouncedSetAmountToStake = useDebounce(setAmountToStake, 200)
  const debouncedSetAmountToUnstake = useDebounce(setAmountToUnstake, 200)
  const debouncedSetAmountToMigrate = useDebounce(setAmountToMigrate, 200)

  function onTabClick(tab: Tab) {
    setActiveTab(tab)
  }

  function onChange(e) {
    switch (activeTab) {
      case Tab.Stake:
        debouncedSetAmountToStake(formMethods.getValues("amountToStake"))
        break
      case Tab.Unstake:
        debouncedSetAmountToUnstake(formMethods.getValues("amountToUnstake"))
        break
      case Tab.Migrate:
        assertNonNullable(migrate)
        debouncedSetAmountToMigrate(formMethods.getValues("amountToMigrate"))
        break
    }
  }

  function onSubmit(e) {
    switch (activeTab) {
      case Tab.Stake:
        stake(amountToStake)
        break
      case Tab.Unstake:
        unstake(amountToUnstake)
        break
      case Tab.Migrate:
        assertNonNullable(migrate)
        migrate(amountToMigrate)
        break
    }
  }

  let amountForActiveTab
  switch (activeTab) {
    case Tab.Stake:
      amountForActiveTab = amountToStake
      break
    case Tab.Unstake:
      amountForActiveTab = amountToUnstake
      break
    case Tab.Migrate:
      amountForActiveTab = amountToMigrate
      break
  }

  let maxAmountForActiveTab
  switch (activeTab) {
    case Tab.Stake:
      maxAmountForActiveTab = maxAmountToStake?.div(new BigNumber(10).pow(token.decimals))
      break
    case Tab.Unstake:
    case Tab.Migrate:
      maxAmountForActiveTab = maxAmountToUnstake?.div(new BigNumber(10).pow(token.decimals))
      break
  }

  const amountInputLabel = maxAmountForActiveTab.isZero()
    ? "Amount"
    : `Amount (max: ${displayNumber(maxAmountForActiveTab)} ${token.ticker})`

  let formInputName
  switch (activeTab) {
    case Tab.Stake:
      formInputName = "amountToStake"
      break
    case Tab.Unstake:
      formInputName = "amountToUnstake"
      break
    case Tab.Migrate:
      formInputName = "amountToMigrate"
      break
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
        {!!migrate && (
          <TabComponent active={activeTab === Tab.Migrate} onClick={() => onTabClick(Tab.Migrate)}>
            {Tab.Migrate.toString()}
          </TabComponent>
        )}
      </Container>
      <FormProvider {...formMethods}>
        <div>
          <div className="form-input-label">{amountInputLabel}</div>
          <div className="form-inputs-footer">
            <TransactionInput
              name={formInputName}
              ticker={token.ticker}
              displayTicker={false}
              formMethods={formMethods}
              maxAmount={maxAmountForActiveTab?.toString(10)}
              onChange={onChange}
              rightDecoration={
                <button
                  className="enter-max-amount"
                  disabled={maxAmountForActiveTab.isZero()}
                  type="button"
                  onClick={() => {
                    formMethods.setValue(
                      formInputName,
                      new BigNumber(maxAmountForActiveTab || 0).decimalPlaces(18, 1).toString(10),
                      {
                        shouldValidate: true,
                        shouldDirty: true,
                      }
                    )
                  }}
                >
                  Max
                </button>
              }
            />
            <button type="button" disabled={!amountForActiveTab} className="button submit-form" onClick={onSubmit}>
              {activeTab.toString()}
            </button>
          </div>
        </div>
      </FormProvider>
    </div>
  )
}
