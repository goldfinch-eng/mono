---
id: overview
title: Smart Contracts Overview
sidebar_position: 1
---

The Goldfinch Protocol's smart contracts are organized into three main categories: Core, Periphery, and GFI Distribution.

## Core

> [**Core Source Code**](https://github.com/goldfinch-eng/mono/tree/main/packages/protocol/contracts/protocol/core)

The core consists of smart contracts that contain the fundamental logic of the Goldfinch Protocol. The Senior Pool, Borrower Pools, UID -- this is where the behavior of these components is defined.

## Periphery

> [**Periphery Source Code**](https://github.com/goldfinch-eng/mono/tree/main/packages/protocol/contracts/protocol/periphery)

The periphery consists of smart contracts that facilitate usage or development of the Goldfinch Protocol, but that are in some sense non-essential for its operation. A primary example of this is the Borrower contract, which provides a convenient way for borrowers to interact with their Borrower Pools, but which is not strictly required for successful interaction.

## GFI Distribution

> [**GFI Distribution Source Code**](https://github.com/goldfinch-eng/mono/tree/main/packages/protocol/contracts/rewards)

This category organizes the logic that manages how GFI are disbursed to participants of the Goldfinch Protocol.

## (Deprecated)

This category contains contracts that are no longer used by the Protocol, but are provided for completeness.
