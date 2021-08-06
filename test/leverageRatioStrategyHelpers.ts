type TestFn = () => (void | Promise<void>)
const NOT_IMPLEMENTED_TEST: TestFn = () => {
  throw new Error("Test has not been implemented!")
}

type InvestmentTests = {
  estimateInvestment: {
    "base": {
      "levers junior investment using the leverageRatio": TestFn
      "correctly handles decimal places, for a fractional leverageRatio": TestFn
    }
    "junior pool is not locked": {
      "investment amount behavior": TestFn
    }
    "pool is locked": {
      "still returns investment amount": TestFn
    }
    "senior principal is already partially invested": {
      "invests up to the levered amount": TestFn
    }
    "senior principal already exceeds investment amount": {
      "does not invest": TestFn
    }
  }
  invest: {
    "base": {
      "levers junior investment using the leverageRatio": TestFn
    }
    "junior pool is not locked": {
      "does not invest": TestFn
    }
    "pool is locked": {
      "does not invest": TestFn
    }
    "senior principal is already partially invested": {
      "invests up to the levered amount": TestFn
    }
    "senior principal already exceeds investment amount": {
      "does not invest": TestFn
    }
  }
}

export const genInvestmentTests = (investmentTests: InvestmentTests): void => {
  Object.keys(investmentTests).forEach((describeBlock) => {
    const contextBlocks = investmentTests[describeBlock]
    describe(describeBlock, () => {
      Object.keys(contextBlocks).forEach((contextBlock) => {
        const tests = contextBlocks[contextBlock]
        context(contextBlock, () => {
          Object.keys(tests).forEach((testName) => {
            const test = tests[testName] || NOT_IMPLEMENTED_TEST
            it(testName, test)
          })
        })
      })
    })
  })
}
