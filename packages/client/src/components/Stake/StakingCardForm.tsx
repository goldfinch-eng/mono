import {assertNonNullable} from "@goldfinch-eng/utils"
import BigNumber from "bignumber.js"
import {useState} from "react"
import {FormProvider, useForm} from "react-hook-form"
import styled from "styled-components"
import {ERC20Metadata} from "../../ethereum/erc20"
import useDebounce from "../../hooks/useDebounce"
import {displayNumber} from "../../utils"
import TransactionInput from "../transactionInput"

type StakingCardFormProps = {
  token: ERC20Metadata
  maxAmountToStake: BigNumber
  maxAmountToUnstake: BigNumber
  stake: (BigNumber) => Promise<any>
  unstake: (BigNumber) => Promise<any>
  migrateForm?: React.ReactNode
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
  migrateForm,
}: StakingCardFormProps) {
  const formMethods = useForm()

  const [activeTab, setActiveTab] = useState<Tab>(Tab.Stake)
  const [amountToStake, setAmountToStake] = useState(0)
  const [amountToUnstake, setAmountToUnstake] = useState(0)

  const debouncedSetAmountToStake = useDebounce(setAmountToStake, 200)
  const debouncedSetAmountToUnstake = useDebounce(setAmountToUnstake, 200)

  function onTabClick(tab: Tab) {
    setActiveTab(tab)
  }

  function onChange() {
    switch (activeTab) {
      case Tab.Stake:
        debouncedSetAmountToStake(formMethods.getValues("amountToStake"))
        break
      case Tab.Unstake:
        debouncedSetAmountToUnstake(formMethods.getValues("amountToUnstake"))
        break
    }
  }

  function onMaxClick(formInputName: string, amount?: BigNumber) {
    formMethods.setValue(formInputName, new BigNumber(amount || 0).decimalPlaces(18, 1).toString(10), {
      shouldValidate: true,
      shouldDirty: true,
    })
    onChange()
  }

  function onSubmit(e) {
    switch (activeTab) {
      case Tab.Stake:
        stake(new BigNumber(amountToStake).multipliedBy(new BigNumber(10).pow(token.decimals)))
        break
      case Tab.Unstake:
        unstake(new BigNumber(amountToUnstake).multipliedBy(new BigNumber(10).pow(token.decimals)))
        break
    }
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
        {!!migrateForm && (
          <TabComponent active={activeTab === Tab.Migrate} onClick={() => onTabClick(Tab.Migrate)}>
            {Tab.Migrate.toString()}
          </TabComponent>
        )}
      </Container>
      {(() => {
        switch (activeTab) {
          case Tab.Stake:
          case Tab.Unstake:
            const amountForActiveTab = activeTab === Tab.Stake ? amountToStake : amountToUnstake
            const maxAmountForActiveTab =
              activeTab === Tab.Stake
                ? maxAmountToStake?.div(new BigNumber(10).pow(token.decimals))
                : maxAmountToUnstake?.div(new BigNumber(10).pow(token.decimals))
            const amountInputLabel = maxAmountForActiveTab.isZero()
              ? "Amount"
              : `Amount (max: ${displayNumber(maxAmountForActiveTab)} ${token.ticker})`
            const formInputName = activeTab === Tab.Stake ? "amountToStake" : "amountToUnstake"

            return (
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
                          onClick={() => onMaxClick(formInputName, maxAmountForActiveTab)}
                        >
                          Max
                        </button>
                      }
                    />
                    <button
                      type="button"
                      disabled={!amountForActiveTab}
                      className="button submit-form"
                      onClick={onSubmit}
                    >
                      {activeTab.toString()}
                    </button>
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
