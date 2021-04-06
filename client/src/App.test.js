import React from "react"
import { App } from "./App"
import { render, screen, waitFor } from "@testing-library/react"

describe("App", () => {
  it("renders without crashing", async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText("Earn Portfolio")).toBeTruthy()
    })
  })
})
