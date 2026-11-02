# Admin Order Alerts (Email + SMS)

Every new order now notifies the admin team automatically:

- **Branded HTML email** with the order value, customer details, itemised products, totals, and a button that opens the order in the admin portal.
- **SMS** with the invoice number, customer name, total, and item count.
- Delivery is **best-effort and non-blocking**: a failed alert never rejects an order. Each channel's outcome is stored on the order (`Sent`, `Failed`, `Skipped`, `Pending`) and shown in **Admin -> Orders -> Alerts**, where it can be resent.

The admin **Settings** page shows live channel status and lets you send test alerts.

## 1. Configure recipients

Add these to `powerflow-backend/.env` (already added for the local environment):

```env
ADMIN_ALERT_EMAIL=powerflowservicesltd@gmail.com
ADMIN_ALERT_PHONE=+250781393649
ADMIN_ALERT_EMAIL_ENABLED=true
ADMIN_ALERT_SMS_ENABLED=true
```

`ADMIN_ALERT_PHONE` must be in international format, for example `+250781393649`. Local numbers starting with `0` are converted using `SMS_DEFAULT_COUNTRY_CODE` (default `250`).

## 2. Connect email

Email uses the existing provider:

- `EMAIL_PROVIDER=gmail-oauth` (current setup) requires a one-time Google authorization.
- `EMAIL_PROVIDER=smtp` uses `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.

### Reconnect Gmail (required if authorized is false)

1. Open `http://localhost:5050/auth/google` (or the production equivalent).
2. Sign in as **powerflowservicesltd@gmail.com** and grant the requested permissions.
3. Return to **Admin -> Settings** and click **Refresh**. The email card should read **Connected**.
4. Click **Send test email** to confirm delivery.

> The local `.env` currently has `GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5050/oauth2callback`. Production must use the production callback URL registered in Google Cloud Console.
>
> On hosts with an ephemeral filesystem, point `GOOGLE_TOKEN_PATH` at a persistent volume. Otherwise the saved token disappears on redeploy and Gmail must be reconnected.

## 3. Enable SMS with Africa's Talking

1. Create an account at <https://africastalking.com>.
2. Create an API key and copy your app username.
3. Set:

```env
AFRICASTALKING_USERNAME=your_app_username
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_SENDER_ID=                # optional approved alphanumeric sender
AFRICASTALKING_BASE_URL=https://api.africastalking.com
```

For sandbox testing use `https://api.sandbox.africastalking.com` and add sandbox test numbers to your Africa's Talking app.

4. Restart the backend.
5. Go to **Admin -> Settings -> Send test SMS**.

SMS delivery is skipped (not failed) when credentials are missing, so email alerts keep working.

## 4. Behaviour and statuses

| Status | Meaning |
| --- | --- |
| `Sent` | Provider accepted the message. |
| `Failed` | Provider returned an error. The reason is stored and shown in the admin portal. |
| `Skipped` | Channel disabled or not configured. |
| `Pending` | Order created before an attempt completed (or legacy order). |

- Alerts are sent in parallel with the customer invoice email, so checkout is not slowed by an extra round trip.
- The alert email includes the order's secure invoice download link.
- The **Resend alert** button on an order calls `POST /api/notifications/order/:id` and updates the stored statuses.
- Test sends call `POST /api/notifications/test` and are rate-limited.

## 5. API

All endpoints require an admin Bearer token.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/notifications/status` | Channel readiness, recipients, sender (no secrets). |
| `POST` | `/api/notifications/test` | `{ "channel": "email" \| "sms" \| "both" }` |
| `POST` | `/api/notifications/order/:id` | Resend the alert for one order. |

## 6. Production deployment checklist

1. Deploy the updated backend and restart it.
2. Set the alert variables in the production environment (do not commit `.env`).
3. Add the production OAuth callback URL to Google Cloud Console and authorize Gmail once on the production host.
4. Add the Africa's Talking credentials and an approved sender ID.
5. Place a test order, then confirm the email and SMS arrive and the order shows **Sent** for both channels.
6. If email shows **Failed**, open **Admin -> Settings** for the provider error (a revoked Gmail grant is the most common cause).
