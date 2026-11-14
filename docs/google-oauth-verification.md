# Google OAuth verification package (Pearl)

Production app URL: https://pearl.tonicagentic.com  
Application home page: https://pearl.tonicagentic.com/about  
Privacy policy: https://pearl.tonicagentic.com/privacy  
Terms of service: https://pearl.tonicagentic.com/terms  
Support email: alex@tonicagentic.com  
GCP project: `tonicagentic-pearl` (350590311352)  
OAuth client redirect: `https://connect.vercel.com/callback`

## Console status (2026-11-14)

| Step | Status |
| --- | --- |
| Branding (home/privacy/terms, domains, support email) | Done — verified and published |
| Audience | **In production** (External) |
| Data Access features | Filled: **Email productivity** + **Email client** |
| Scope justification | Draft filled in Data Access (verification mode) — see below |
| Demo video (YouTube Unlisted) | **Blocking** — required before Save / Confirm |
| Verification Center submit | Blocked until demo video URL is saved |

Authorized domains: `tonicagentic.com`, `vercel.com`  
Developer contact: `alex@tonicagentic.com`

## Scopes requested

| Scope | Why Pearl needs it | Why a narrower scope is insufficient |
| --- | --- | --- |
| `https://www.googleapis.com/auth/gmail.readonly` | Search threads, open messages, list labels/drafts for triage and summaries | `gmail.metadata` cannot read bodies needed for triage |
| `https://www.googleapis.com/auth/gmail.compose` | Create drafts and send mail after user approval | `gmail.send` alone cannot create drafts Pearl shows for edit |
| `https://www.googleapis.com/auth/gmail.modify` | Archive, mark read, apply labels via `apply_mail_batch` | Labels-only scopes cannot archive / mark-read batches |

Application type for Gmail policy: **email productivity / personal assistant** that extends Gmail with agent-assisted triage and approved send.

## Scope justification (paste into Data Access)

Pearl is a personal email productivity assistant. Users connect Gmail so Pearl can search/read threads for triage and summaries (gmail.readonly), create drafts and send only after explicit user approval (gmail.compose), and archive/mark-read/apply labels in batches the user approves (gmail.modify). gmail.metadata cannot read bodies needed for triage; gmail.send alone cannot create editable drafts; labels-only scopes cannot archive or mark-read. Data is used only to power these user-facing features; no ads, no sale/transfer to data brokers, no credit scoring. Human access only with user agreement for specific items, for security/legal compliance, or aggregated internal ops.

## Limited Use attestation

Pearl uses Google user data only to provide user-facing features in the Pearl UI (search/read, draft, approved send, label/archive). No ads, no sale/transfer to brokers, no credit use. Human access only with user agreement for specific items, for security/legal, or aggregated internal ops.

## Demo video checklist (YouTube Unlisted)

Record in English, show the live browser URL bar with the OAuth client ID on the consent screen. Include the “unverified app” warning if it appears. Prefer a test account / staging so you do not put unverified scopes on production traffic.

1. Open https://pearl.tonicagentic.com → sign in  
2. Settings → Email / Plugins → Connect Gmail  
3. Google consent screen showing app name **Pearl** and the three scopes  
4. After connect: ask Pearl to search recent mail (`search_gmail_threads`)  
5. Open a thread (`get_gmail_thread`)  
6. Create a draft (`create_gmail_draft`) and show approval gate  
7. Apply archive/label batch (`apply_mail_batch`) with approval  
8. Disconnect / mention Settings delete account path  

Paste the Unlisted YouTube URL into **Data Access → Demo video → YouTube link**, click **Save**, then **Verification Center → Prepare for verification → Confirm**.

## CASA / security assessment

Because Pearl’s backend calls Gmail with Connect-issued tokens (server-side access), Google will require an annual CASA assessment from a Google-approved assessor after (or during) restricted-scope review. That step cannot be completed inside the Cloud Console alone; schedule an assessor when Google’s verification email requests it.

## Documentation links to attach in Verification Center

1. https://pearl.tonicagentic.com/about  
2. https://pearl.tonicagentic.com/privacy  
3. https://pearl.tonicagentic.com/terms  
4. https://github.com/tonicagentic/pearl (optional public source)  
