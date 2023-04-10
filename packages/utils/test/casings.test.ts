import {expect} from "chai"

import {camelize} from "../src/casings"

describe("casings", () => {
  it("camelizes", () => {
    const expects = (input: any, output: any) => expect(camelize(input)).to.eql(output)

    expects(["one", "two", "three"], ["one", "two", "three"])
    expects({one: 1}, {one: 1})
    expects({one: "one"}, {one: "one"})
    expects({a: "a", b: "b"}, {a: "a", b: "b"})
    expects({a_a: "a", b_b: "b"}, {aA: "a", bB: "b"})
    expects({a_ab_abc: "a", b_b: "b"}, {aAbAbc: "a", bB: "b"})
    expects(
      {a_ab_abc: ["one", "two", {red_blue: "five", blue_fish: 6}], b_b: "b"},
      {aAbAbc: ["one", "two", {redBlue: "five", blueFish: 6}], bB: "b"}
    )
    expects({a_a: {a_a: {a_a: {a_a: {a_a: [{a_a: [{a_a: 1}]}]}}}}}, {aA: {aA: {aA: {aA: {aA: [{aA: [{aA: 1}]}]}}}}})
  })
})
