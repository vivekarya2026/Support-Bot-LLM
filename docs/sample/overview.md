# AgentPay Overview

> **PLACEHOLDER CONTENT.** Replace with real AgentPay product copy before launch.

AgentPay is a payment infrastructure for AI agents. It lets autonomous agents
hold balances, spend on behalf of a human principal, and settle transactions
with merchants — all under programmable policy limits.

## What problem does it solve?

Traditional payment rails (credit cards, ACH, bank transfers) were built
for human-initiated transactions. They assume a person at a checkout, an
SMS code, a tap on a phone. AI agents acting on behalf of users break those
assumptions: they need to pay in milliseconds, at machine scale, without
prompting a human for every charge — but they also need guardrails so they
can't drain an account or get phished by a malicious merchant.

AgentPay sits between the user, the agent, and the merchant:

- The **user** sets policies (spend caps, allowed merchants, time-of-day rules).
- The **agent** requests a charge through AgentPay.
- AgentPay **authorizes** the charge against the policy and either settles
  immediately or escalates to the user for confirmation.

## Who uses it?

- AI shopping agents (groceries, travel, gifts)
- Research and data agents (paying for API credits and datasets)
- Workflow agents (paying for cloud compute, SaaS subscriptions on demand)

## Key concepts

- **Principal** — the human (or org) who owns the funds.
- **Agent** — the AI that initiates charges.
- **Policy** — the rules constraining what the agent can spend.
- **Authorization** — a single approved transaction.
- **Settlement** — the actual movement of money to the merchant.
