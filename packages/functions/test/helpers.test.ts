import chai from "chai"
import {originAllowed, removeUndefinedProperties} from "../src/helpers"
const expect = chai.expect

describe("helpers", () => {
  describe("originAllowed", () => {
    const allowedOrigins = ["http://localhost:3000", "https://deploy-preview*netlify.app"]
    it("should allow wildcards", () => {
      expect(originAllowed(allowedOrigins, "https://deploy-preview-512-goldfinch-netlify.app")).to.be.true
    })

    it("should allow direct matches", () => {
      expect(originAllowed(allowedOrigins, "http://localhost:3000")).to.be.true
    })

    it("should not allow incorrect direct matches", () => {
      expect(originAllowed(allowedOrigins, "http://localshot:3001")).to.be.false
    })

    it("should not allow incorrect wildcard matches", () => {
      expect(originAllowed(allowedOrigins, "https://deploy-prev-goldfinch.netlify.app")).to.be.false
    })
  })

  describe("removeUndefinedProperties", () => {
    const REMOVE_NULL_FALSE = {removeNull: false}
    const REMOVE_NULL_TRUE = {removeNull: true}

    describe("primitive types", () => {
      ;[
        null,
        undefined,
        "hello",
        1,
        true,
        BigInt("1234"),
        () => {
          return "I am a function"
        },
        Symbol("foo"),
      ].forEach((value) => {
        it("should return the primitive without modification", () => {
          expect(removeUndefinedProperties(value, REMOVE_NULL_FALSE)).to.eq(value)
          expect(removeUndefinedProperties(value, REMOVE_NULL_TRUE)).to.eq(value)
        })
      })
    })

    it("should return an empty object if given an empty object", () => {
      expect(removeUndefinedProperties({}, REMOVE_NULL_FALSE)).to.deep.eq({})
      expect(removeUndefinedProperties({}, REMOVE_NULL_TRUE)).to.deep.eq({})
    })

    it("should remove an undefined field", () => {
      expect(removeUndefinedProperties({a: undefined, b: "hello"}, REMOVE_NULL_TRUE)).to.deep.eq({b: "hello"})
      expect(removeUndefinedProperties({a: undefined, b: "hello"}, REMOVE_NULL_FALSE)).to.deep.eq({b: "hello"})
    })

    it("should remove an undefined nested field", () => {
      expect(removeUndefinedProperties({a: {b: undefined, c: "hello"}}, REMOVE_NULL_TRUE)).to.deep.eq({a: {c: "hello"}})
      expect(removeUndefinedProperties({a: {b: undefined, c: "hello"}}, REMOVE_NULL_FALSE)).to.deep.eq({
        a: {c: "hello"},
      })
    })

    it("should not remove an empty array", () => {
      expect(removeUndefinedProperties({a: [], b: "hello"}, REMOVE_NULL_TRUE)).to.deep.eq({a: [], b: "hello"})
      expect(removeUndefinedProperties({a: [], b: "hello"}, REMOVE_NULL_FALSE)).to.deep.eq({a: [], b: "hello"})
    })

    it("should remove undefined fields from objects in an array", () => {
      expect(removeUndefinedProperties({a: [{b: undefined, c: "hello"}]}, REMOVE_NULL_TRUE)).to.deep.eq({
        a: [{c: "hello"}],
      })
      expect(removeUndefinedProperties({a: [{b: undefined, c: "hello"}]}, REMOVE_NULL_FALSE)).to.deep.eq({
        a: [{c: "hello"}],
      })
    })

    it("should not modify an object without null or undefined fields", () => {
      expect(removeUndefinedProperties({a: {b: "hello"}, c: [{d: "goodbye"}]}, REMOVE_NULL_TRUE)).to.deep.eq({
        a: {b: "hello"},
        c: [{d: "goodbye"}],
      })
      expect(removeUndefinedProperties({a: {b: "hello"}, c: [{d: "goodbye"}]}, REMOVE_NULL_FALSE)).to.deep.eq({
        a: {b: "hello"},
        c: [{d: "goodbye"}],
      })
    })

    it("should remove null entries from an array", () => {
      expect(removeUndefinedProperties({a: [null, "hello"]}, REMOVE_NULL_TRUE)).to.deep.eq({a: ["hello"]})
      expect(removeUndefinedProperties({a: [null, "hello"]}, REMOVE_NULL_FALSE)).to.deep.eq({a: ["hello"]})
    })

    it("should remove undefined entries from an array", () => {
      expect(removeUndefinedProperties({a: [undefined, "hello"]}, REMOVE_NULL_TRUE)).to.deep.eq({a: ["hello"]})
      expect(removeUndefinedProperties({a: [undefined, "hello"]}, REMOVE_NULL_FALSE)).to.deep.eq({a: ["hello"]})
    })

    describe("when removeNull=true", () => {
      it("does remove a null field", () => {
        expect(removeUndefinedProperties({a: null, b: "hello"}, REMOVE_NULL_TRUE)).to.deep.eq({b: "hello"})
      })

      it("does remove a null nested field", () => {
        expect(removeUndefinedProperties({a: {b: null, c: "hello"}}, REMOVE_NULL_TRUE)).to.deep.eq({a: {c: "hello"}})
      })

      it("should remove null fields from objects in an array", () => {
        expect(removeUndefinedProperties({a: [{b: null, c: "hello"}]}, REMOVE_NULL_TRUE)).to.deep.eq({
          a: [{c: "hello"}],
        })
      })
    })

    describe("when removeNull=false", () => {
      it("does not remove a null field", () => {
        expect(removeUndefinedProperties({a: null, b: "hello"}, REMOVE_NULL_FALSE)).to.deep.eq({a: null, b: "hello"})
      })

      it("does not remove a null nested field", () => {
        expect(removeUndefinedProperties({a: {b: null, c: "hello"}}, REMOVE_NULL_FALSE)).to.deep.eq({
          a: {b: null, c: "hello"},
        })
      })

      it("should not remove null fields from objects in an array", () => {
        expect(removeUndefinedProperties({a: [{b: null, c: "hello"}]}, REMOVE_NULL_FALSE)).to.deep.eq({
          a: [{b: null, c: "hello"}],
        })
      })
    })
  })
})
