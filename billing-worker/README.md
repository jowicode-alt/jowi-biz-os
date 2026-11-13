# InterCampus Billing Worker

The billing service runs on Cloudflare Workers + D1. It does **not** use Firebase service accounts, Google Cloud service-account credentials, Cloud Functions, or Google Cloud Billing. Firebase ID tokens are used for owner-authorized Firestore reads; Firestore security rules remain in force. JJuma secrets stay in Worker secrets.

## Required GitHub Actions secrets

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers Scripts edit and D1 read/write permissions.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `JJUMA_SECRET_KEY` — JJuma secret API key.
- `JJUMA_WEBHOOK_SECRET` — add after configuring the JJuma webhook destination.

Never put secret values in browser JavaScript or commit them to GitHub. **Do not add a Firebase service-account key or enable Google Cloud Billing.**

## One-time Cloudflare setup

1. In Cloudflare Dashboard, open **Workers & Pages → D1 SQL Database** and create a database named `intercampus-billing`.
2. Copy its database ID into `database_id` in `billing-worker/wrangler.toml`, replacing `CREATE_D1_DATABASE_FIRST`.
3. Add the three initial GitHub Actions secrets above (the webhook secret can be added after webhook creation).
4. Push/re-run the **Deploy InterCampus billing Worker** workflow. It applies the D1 migration and deploys the Worker.
5. Set the deployed Worker URL as the app's `INTERCAMPUS_BILLING_API` configuration before enabling checkout.
6. In JJuma Dashboard → Tools → Webhooks, add `https://<worker-host>/webhooks/jjuma`, subscribe to `payment.completed`, then save its signing secret as `JJUMA_WEBHOOK_SECRET` and redeploy.

## Routes

- `GET /health` — Worker health.
- `GET /billing/summary` — owner-authenticated active-student count, trial/subscription state and recent payments.
- `POST /billing/checkout` — creates a JJuma hosted checkout and snapshots the count/amount.
- `POST /webhooks/jjuma` — validates JJuma HMAC and verifies payment server-to-server before updating D1.

## Billing rules encoded

- UGX 250 per active, fully registered student per monthly billing period.
- Pending invitations and inactive students are excluded.
- A new institution created on/after the rollout date gets a 14-day trial anchored to Firestore's server-created institution timestamp. Institutions created before rollout do not receive a retroactive trial.
- First successful payment establishes the monthly renewal date (calendar-month addition, clamped at month-end).
- Additional students are charged proportionally for the remaining seconds in the paid period. A seven-day grace batch is recorded when additional active students are first detected.
- Historical student records are not deleted.

## Important safety status

This is an integration foundation, not permission to start taking live payments yet. The app does not enforce access restrictions for unpaid students, and institution-wide behavior after a trial expires remains intentionally unenforced pending the owner's policy decision. Before live launch, validate JJuma test-mode webhook payload/signature and verify endpoint response fields against a real test transaction. The UI must not be considered production-ready until the Worker is deployed and the app is pointed at its URL.


Deployment configuration was updated for the existing `intercampus-billing` D1 database.
