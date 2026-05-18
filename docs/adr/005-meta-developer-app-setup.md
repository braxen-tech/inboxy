# ADR-005: Meta Developer App Setup (One-Time)

## Status
Accepted

## Context
We use one Meta Developer App for the WhatsApp Cloud API. **MVP:** each organization pastes **WABA ID**, **Phone number ID**, and **access token** in the dashboard (validadas e guardadas cifradas). **Embedded Signup** (BSP/TP) pode ser reativado mais tarde; exige Login for Business extra.

## Setup Instructions

### 1. Create Meta App
1. Go to https://developers.facebook.com/apps
2. Click "Create App" → Select "Business" type
3. App name: your SaaS name (e.g. "WhatsApp Agent")
4. Link to your Meta Business Suite account

### 2. Add Products
Add the following products to the app:
- **WhatsApp** — for messaging API
- **Facebook Login for Business** — só se usar Embedded Signup (opcional vs. MVP manual)

### 3. Configure Facebook Login for Business
1. Settings → Valid OAuth Redirect URIs: `https://your-domain.com/api/integrations/whatsapp/connect`
2. Settings → Deauthorize Callback URL: `https://your-domain.com/api/integrations/whatsapp/deauth`

### 4. Configure WhatsApp
1. Getting Started → note the Phone Number ID and Token (for dev testing)
2. Configuration → Webhook URL: `https://your-domain.com/api/webhooks/whatsapp`
3. Configuration → Verify Token: same value as `META_WEBHOOK_VERIFY_TOKEN` env var
4. Configuration → Webhook fields: subscribe to `messages`

### 5. App Settings
1. Settings → Basic: note App ID and App Secret
2. Settings → Advanced → Security: Enable "Require App Secret" for API calls

### 6. Embedded Signup (opcional, além do MVP manual)
1. WhatsApp → Embedded Signup → Enable (se disponível para o app / parceiros)
2. Login Configuration com `whatsapp_business_management` e `whatsapp_business_messaging`
3. `META_EMBEDDED_SIGNUP_CONFIG_ID` só é necessário nesse fluxo OAuth

### 7. App Review
For production use beyond test users:
- Request `whatsapp_business_management` permission
- Request `whatsapp_business_messaging` permission
- Submit for App Review with use case description

## Environment Variables
```
META_APP_ID=<from step 5.1>
META_APP_SECRET=<from step 5.1>
META_WEBHOOK_VERIFY_TOKEN=<random string you generate>
```

## Consequences
- All tenants usam este Meta App para Cloud API; onboarding manual no dashboard até haver BSP/Embedded Signup
- Rotacão de tokens é responsabilidade do cliente quando não usam token de sistema sem expiração
- App Review is required for production launch (can take 2-5 business days)
- Development and testing can be done with test phone numbers without App Review
