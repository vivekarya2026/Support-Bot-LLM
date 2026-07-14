# AgentPay FAQ

> **PLACEHOLDER CONTENT.** Replace with real FAQ before launch.

## How is AgentPay different from Stripe or Plaid?

Stripe and Plaid are excellent for **human-initiated** payments and bank
connections. AgentPay is purpose-built for **agent-initiated** payments —
policy enforcement, real-time risk checks, agent-aware fraud signals, and
authorization flows that don't require a human in the loop for every charge.

You can think of AgentPay as a layer that sits on top of existing rails:
under the hood, settlements still go through standard processors. The
value AgentPay adds is the policy and authorization layer for agents.

## Is my money safe?

Funds in AgentPay are held by partner banks insured up to standard FDIC
limits (US). AgentPay itself does not custody funds; we are the policy
and authorization layer.

## Can an agent drain my account?

No, assuming your policies are configured correctly. Every authorization
is checked against your policy before settlement. Typical safeguards:

- **Hard spend cap per day / week / month**
- **Per-transaction max**
- **Merchant allowlist or denylist**
- **Velocity limits** (e.g., max 10 transactions / hour)
- **Step-up confirmation** for anything over a threshold

If a policy denies a transaction, the agent receives a clear error and
the user is notified.

## What happens if an agent makes a mistake?

Disputes work like any payment dispute — you can flag a transaction in
the AgentPay dashboard and we will issue a chargeback through the
underlying rail. AgentPay also stores the full agent reasoning trace
for every authorization, which makes disputes faster to resolve.

## Do you support recurring charges / subscriptions?

Yes. An agent can request a recurring authorization, which the user
approves once. The recurring schedule is enforced by AgentPay, not the
merchant, so the user can revoke it at any time without contacting the
merchant.

## What countries are supported?

At launch: United States, Canada, United Kingdom, and the EU/EEA.
Australia, Singapore, and Japan are on the roadmap.

## How do I get an API key?

Sign up at agentpay.example, create a project, and generate a key from
the API keys page. Developer-tier keys work in sandbox immediately;
production keys require KYC verification.
