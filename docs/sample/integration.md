# Integrating with AgentPay

> **PLACEHOLDER CONTENT.** Replace with real integration docs before launch.

This guide walks through wiring AgentPay into an AI agent.

## 1. Get credentials

After signing up, create a project in the AgentPay dashboard and
generate an API key. Sandbox keys begin with `apsk_test_`; production
keys begin with `apsk_live_`.

## 2. Install the SDK

```bash
npm install @agentpay/sdk
# or
pip install agentpay
```

## 3. Define a policy

A policy is the contract between the principal (human) and the agent.
Below is a simple policy that lets an agent spend up to $50/day on
groceries, with a $20 per-transaction cap.

```ts
import { AgentPay } from "@agentpay/sdk";

const ap = new AgentPay({ apiKey: process.env.AGENTPAY_KEY });

const policy = await ap.policies.create({
  name: "Weekday grocery runs",
  caps: {
    perTransaction: { amount: 2000, currency: "USD" },
    perDay: { amount: 5000, currency: "USD" },
  },
  merchants: {
    allow: ["mcc:5411"], // grocery stores
  },
});
```

## 4. Authorize a charge

When the agent is ready to pay, it requests an authorization. AgentPay
runs the request against the policy and either approves, denies, or
escalates.

```ts
const auth = await ap.authorizations.create({
  policyId: policy.id,
  merchant: { id: "merch_whole_foods_123" },
  amount: { value: 1842, currency: "USD" },
  metadata: { cartId: "cart_abc" },
});

if (auth.status === "approved") {
  // proceed with checkout using auth.id as the payment token
}
```

## 5. Handle escalations

If a charge falls outside the policy and the policy allows escalation,
AgentPay sends a push notification or email to the principal. The
principal can approve or deny in the dashboard. The agent polls or
subscribes to webhooks to learn the outcome.

```ts
ap.webhooks.on("authorization.escalation.resolved", async (event) => {
  // event.authorizationId, event.status
});
```

## 6. Reconcile in the dashboard

Every authorization, settlement, and dispute is visible in the
AgentPay dashboard, with the full reasoning trace from the agent.
