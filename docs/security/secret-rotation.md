# Secret Rotation Runbook

## Scope

Applies to:

- `whatsapp.api_key` / `DRIPSENDER_API_KEY`
- `mail.smtp_pass`
- `RESEND_API_KEY`
- `MAILTRAP_API_TOKEN`
- `GOOGLE_CLIENT_SECRET`
- `WHATSAPP_WEBHOOK_SECRET`

## Required procedure after secret exposure

1. Disable or revoke the old provider credential at the provider dashboard.
2. Generate a new credential using the provider's strongest available scope.
3. Store the new value in the server environment/secret manager or protected admin setting.
4. Restart/redeploy the application so all workers receive the new value.
5. Update the external webhook configuration with the new webhook secret.
6. Verify that the old credential no longer authenticates.
7. Check provider audit logs for activity during the exposure window.
8. Record rotation time, owner, provider, and incident/reference ID without recording the secret itself.

## Application guarantees

- Public and authenticated Inertia page payloads expose only allowlisted public settings.
- WhatsApp admin UI receives `hasApiKey`, never the key value.
- Blank API-key submissions preserve the server-side value without returning it to the browser.
- Tests in `tests/security/secrets.test.ts` assert that secret names and values are absent from SSR HTML, XHR page payloads, authenticated pages, and the WhatsApp admin payload.

## Operator limitation

The repository cannot rotate live provider credentials automatically because it does not own the provider accounts or deployment secret store. A deployment owner must execute the provider-dashboard steps above. This limitation must remain visible in the release checklist; it must not be represented as an automated pass.
