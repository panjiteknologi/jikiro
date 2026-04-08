# TriPay Webhook Readiness

Use this checklist before enabling the TriPay callback in a shared or production environment.

## Environment

- Set `APP_BASE_URL` to the public app URL, or explicitly set both `TRIPAY_CALLBACK_URL` and `TRIPAY_RETURN_URL`.
- Provide `TRIPAY_ENVIRONMENT`, `TRIPAY_API_KEY`, `TRIPAY_PRIVATE_KEY`, and `TRIPAY_MERCHANT_CODE`.
- Confirm the deployed callback resolves to `/api/billing/tripay/callback`.

## Checkout

- Verify `GET /api/billing/tripay/channels` returns at least one channel in the target environment.
- Confirm checkout creation stores the selected `interval` and returns a valid `checkout_url`.
- Confirm the billing page opens with the expected `?interval=monthly|yearly` deep-link.

## Webhook

- Send a signed `payment_status` callback from TriPay sandbox or production, depending on the target environment.
- Confirm a paid callback updates `BillingCheckout`, creates or updates `Subscription`, and grants credits exactly once.
- Replay the same callback once to confirm duplicate events are ignored through `BillingEvent.eventKey`.

## Automated Coverage

- Auth preview tests cover the monthly/yearly toggle and redirect-aware plan links.
- Billing tests cover interval deep-links after sign-up.
- Webhook tests cover invalid signature, paid activation, and duplicate callback handling.
