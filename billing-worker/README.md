# InterCampus Billing Worker

This Worker is the private server-side payment layer for InterCampus Attendance. It is separate from Firebase Hosting and does not modify the Super Admin portal.

## Required GitHub Actions secrets

Add these four repository Actions secrets before the first deployment:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers Scripts edit permission.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `FIREBASE_SERVICE_ACCOUNT_JOWI_BIZ_OS` — service-account JSON for Firebase project `jowi-biz-os`, with Firestore access.
- `JJUMA_SECRET_KEY` — JJuma secret API key.
- `JJUMA_WEBHOOK_SECRET` — optional for the first deployment; add it after creating the JJuma webhook destination. The webhook endpoint rejects events until this secret is configured.

Never put any of these values in browser JavaScript or commit them to GitHub.

## Worker routes

- `GET /health` — deployment health check.
- `GET /billing/summary` — verifies Firebase sign-in and owner role, then counts active student documents on the server.
- `POST /billing/checkout` — creates a JJuma hosted checkout for the institution.
- `POST /webhooks/jjuma` — verifies JJuma HMAC signature and confirms the transaction with JJuma before activating the subscription.

## JJuma webhook

After the Worker has deployed, add its URL in JJuma Dashboard → Tools → Webhooks. Subscribe to `payment.completed` and copy the generated webhook signing secret into the GitHub Actions secret `JJUMA_WEBHOOK_SECRET`, then rerun the Worker deployment workflow. The Worker endpoint is `https://<worker-host>/webhooks/jjuma`.

## Important rollout note

The first implementation provides the 14-day trial record, owner-only subscription page, secure active-student count, hosted checkout and verified initial subscription activation. Before charging existing institutions or enforcing access restrictions, complete the next rollout stage for per-student seat proration, 7-day grace enforcement, and payment-history/receipt display. Do not enable live billing until the webhook has been configured and tested with JJuma test credentials.
