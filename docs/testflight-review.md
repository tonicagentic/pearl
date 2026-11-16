# TestFlight review account

Apple's Beta App Review uses one shared Pearl account. Do not put a friend's or tester's email in the demo login.

| | |
| --- | --- |
| Email | `test@tonicagentic.com` |
| Password | `pearl-test` |
| Name | Test |

The account already exists on production. Reviewers **sign in** with the demo login above. First launch also offers guest chat without an account; the review notes still tell Apple to use this shared account so they land on the friend trial.

## Why this account

The demo user is on `PEARL_TRIAL_ALLOWLIST`, so sign-in opens the friend trial: no Stripe Checkout and no App Store purchase. A reviewer who hits a paywall, or who is told to sign up with someone else's email, is the usual reason this build gets rejected.

Keep `test@tonicagentic.com` on `PEARL_TRIAL_ALLOWLIST` in the Vercel production and preview environments. After changing that variable, redeploy production. The running deployment does not pick up env edits on its own.

## App Store Connect

On the Pearl app (`6834637706`), Beta App Review Information stays:

- Sign-in required
- Demo email `test@tonicagentic.com`
- Demo password `pearl-test`
- Notes tell the reviewer to stay on **Sign in**, send one chat, and find **Delete account** in Settings

The password in this file and the password in App Store Connect are the same value. Change them together. Do not rotate it to a personal account.

External testers belong on the **Friends** TestFlight group. That list is separate from this review login.
