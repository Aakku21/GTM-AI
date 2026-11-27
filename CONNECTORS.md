# SignalStack GTM — Connector Setup Instructions

Each workspace isolates its own integrations and credentials. A new **Live Workspace** starts with **0 connected tools**, and CSV/Excel import and export work immediately without any external account.

## Core Integrations (6)

1. **Apollo** (`APOLLO_API_KEY`)
   - Endpoints used: `POST /api/v1/mixed_companies/search`, `POST /api/v1/mixed_people/search`, `POST /api/v1/people/match`
   - Docs: https://docs.apollo.io/reference/organization-search
2. **Hunter** (`HUNTER_API_KEY`)
   - Endpoint used: `GET /v2/email-verifier`
   - Stores provider verdict (`valid`, `invalid`, `accept-all`, `unknown`) and verification date.
   - Docs: https://hunter.io/api-documentation/v2#email-verifier
3. **HubSpot** (`HUBSPOT_ACCESS_TOKEN`)
   - Endpoints used: CRM v3 `/crm/v3/objects/companies`, `/crm/v3/objects/contacts`, `/crm/v3/objects/tasks`
   - Scopes required: `crm.objects.companies.read/write`, `crm.objects.contacts.read/write`, `crm.objects.deals.read`
   - Docs: https://developers.hubspot.com/docs/api/crm/contacts
4. **Gmail** (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`)
   - Scopes: `https://www.googleapis.com/auth/gmail.compose`, `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/gmail.readonly`
   - Supports multiple connected mailboxes counted as 1 Gmail tool.
5. **Microsoft 365 Outlook** (`MICROSOFT_GRAPH_CLIENT_ID`, `MICROSOFT_GRAPH_CLIENT_SECRET`, `MICROSOFT_GRAPH_TENANT_ID`)
   - Graph scopes: `Mail.ReadWrite`, `Mail.Send`, `User.Read`
6. **Google Sheets** (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`)
   - Scopes: `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive.file`
   - Counted separately from Gmail (Gmail + Google Sheets = 2 connected tools).

## Extended & Custom Connectors

- Configure **Clay**, **People Data Labs / ZoomInfo**, **Crunchbase**, **BuiltWith**, **LinkedIn Lead Gen Forms**, **Meta Lead Ads**, **Website Forms / Typeform / Segment / Mailchimp / GA4**, **Salesforce / Dynamics 365 / Pipedrive / Slack / Teams**, **Outreach / Salesloft / n8n / Make / Zapier**, and **PostgreSQL / BigQuery / Snowflake / Microsoft Fabric** from the **Integrations** screen.
- Any additional internal system can be connected using **Add Custom REST / Webhook** with HMAC signed webhooks, Bearer tokens, or header API keys plus declared operations and field mappings.
