# Sign in

- **Route:** `/sign-in` — iOS ✅ · Android ✅

## Purpose

Authenticate against the Lexus account service. One scrolling screen that
changes shape as the flow advances: credentials, then (when the account requires
verification) a delivery-method choice, then a one-time code. Reaching a session
flips the root layout's auth guard and this screen unmounts.

## Data

Everything comes from the auth context (`src/auth/auth-context.tsx`), which
drives the Lexus authentication tree:

- `step` — the current node's classification, mapped to a screen name by
  `signInScreenFor` in `sign-in-copy.ts`: `choice` → choice, `otp` → otp,
  anything else (including no node at all) → credentials.
- `busy` — a request is in flight.
- `error` — a user-facing message, already composed by `sign-in-error.ts`.
- `choices` — the verification methods the account offered, as server-worded
  labels ("Text message to \*\*\*-1234").
- `method` — the label the user picked; `canChangeMethod` is true only when more
  than one was offered.
- `prompt` — the server's own prompt text for the current node, when present.
- Actions: `submitCredentials(username, password)`, `submit(indexOrCode)`,
  `resendCode()`, `changeMethod()`.

Local to the screen: the email, password, and code field values, plus refs to
the three fields.

Copy is derived, not hard-coded per screen — `sign-in-copy.ts` owns it:

- `classifyDeliveryMethod` buckets a method label into `email` / `sms` /
  `unknown` by keyword ("email"/"e-mail"; "sms", "text", "phone", "mobile",
  "call").
- `otpCopy(method)` turns that into the OTP hero and field placeholder: "Check
  Your Email" / "Check Your Messages" / "Enter Your Code". The server's own OTP
  prompt is boilerplate, so the derived copy wins there — this is what keeps an
  email selection from mislabeling its screen as an SMS code.
- `choiceIcon(choice)` picks the per-choice glyph. Every icon this module hands
  out is named from the icon registry (`src/components/ui/icon-registry.ts`),
  not as an SF Symbol, so each tree resolves the same name to its own platform's
  glyph.
- `signInHero(screen, method, prompt)` returns icon + title + subtitle for each
  screen. Credentials: "Welcome to Lexy" / "Sign in with your Lexus account to
  see and control your vehicle." Choice: "Verify It's You", subtitled with the
  server prompt when there is one (the choice node can carry real context),
  falling back to "Choose how you'd like to receive your verification code."
  OTP: the derived copy.

## Structure

One vertically scrolling column, centered, in this order. The screen name
transition is animated so the relayout springs rather than snaps.

1. **Hero** — icon, title, subtitle for the current screen.
2. **Credentials screen only** — an email field and a password field grouped as
   one rounded card with a divider between them, then the primary **Sign In**
   button. Email autofocuses; its return key advances to the password field,
   whose return key submits. Email is lower-cased, autocorrect-free, and typed
   with an email keyboard; both fields declare their credential content types so
   the platform password manager can fill them.
3. **Choice screen only** — one row of equal-width buttons, one per offered
   method, each with its channel icon and the server's own label. The row splits
   the available width evenly no matter how long the labels are.
4. **OTP screen only** — a numeric one-time-code field (autofocused, declaring
   the platform's one-time-code content type so an SMS code can be auto-filled),
   the primary **Verify** button, then **Resend Code** and — only when
   `canChangeMethod` — **Use a Different Method**.
5. **Error notice**, when `error` is set: a warning glyph and the message on a
   card. It sits below the active screen's controls, so it is adjacent to the
   thing that failed.
6. **Credentials screen only** — a "New to Lexus?" callout card explaining that
   an account and vehicle are created in the official Lexus app, with a "Get the
   Lexus App" action.
7. A permanent footnote: "Your password and verification code go directly to
   Lexus. Lexy never stores them or collects your information."

## States

- **Busy.** Every action is a no-op while `busy`. The primary button keeps its
  prominent fill and swaps its label to a progressive form ("Signing In…",
  "Verifying…") rather than dimming — the handler already guards the double
  submit, and dimming made the fill flicker from blue to grey and back. Choice
  buttons and the two secondary OTP actions *are* disabled while busy.
- **Empty fields.** Only emptiness dims the primary button: Sign In needs a
  non-blank email and a non-empty password, Verify needs a non-blank code.
- **Error.** Errors never replace the screen; the form stays filled and the
  notice appears alongside it. Messages are composed by `sign-in-error.ts` from
  two axes — *what failed* (network, rejected, rate-limited, server, protocol,
  session, unknown) and *which action* it was (credentials, choice, otp, resend,
  restore) — so the advice always names the control the user is looking at
  ("tap Verify again", "request a code again"). Rejections get bespoke copy per
  stage: a bad password suggests case sensitivity and a possible lockout; a bad
  code explains that codes are single-use and short-lived and points at Resend.
- **The tree dead-ends.** A response that classifies as a choice but offers no
  choices (an unknown account's "User Not Found" message node is the known
  case) never renders: it reads as a rejection of the action that produced it,
  so the user stays on a screen where they can act, with the stage's rejected
  copy beside the form.
- **Session expired mid-flow.** Resend and change-method need the credentials
  the app is holding in memory. If they are gone, the flow resets to the
  credentials screen with a message saying so.
- **Signed out by a rejected saved session.** The auth provider sets the
  `restore`-stage message before this screen mounts, so the user arrives with
  the explanation already on screen.

## Interactions

- **Sign In** (button or password field submit) — trims the email and calls
  `submitCredentials`. The auth context answers the username and password nodes
  back to back, so the intermediate password step is never shown.
- **A choice button** — `submit(index)`. The context records both the chosen
  label and the full offered set before advancing.
- **Verify** (button or code field submit) — `submit(trimmedCode)`.
- **Resend Code** — clears the entered code, then restarts the authentication
  tree from scratch, replaying the stored credentials and re-selecting the same
  delivery method (matched by label, since the tree may reorder choices). Lexus
  models verification as a linear tree with no native resend, so re-traversing
  the choice node is how a fresh code is dispatched. Lands back on OTP.
- **Use a Different Method** — the same restart, but stopping at the choice step
  so the user re-picks. The remembered method is dropped so the OTP copy isn't
  stale.
- **Get the Lexus App** — opens the Lexus app's *store listing*, not its
  universal link: this callout is for someone with no account yet, and the store
  is where they install the app to create one. The listing is whichever store
  the device has — `LEXUS_APP_STORE_URL` in `src/data/lexus-app.ts` selects the
  App Store entry or the Play one.
- Every action gives a light impact haptic before running.
- Dragging the scroll view dismisses the keyboard interactively (iOS; see
  Platform notes).

## Platform notes

- **Fields are explicitly blurred before a submit that can end the flow.** A
  successful sign-in unmounts this screen while a field is still first
  responder; the keyboard disappears with the view but is never formally
  resigned, leaving the scene's keyboard safe-area inset stuck for every later
  screen. Android does not inherit that bug — the IME is window state there and
  comes down on its own when the focused field leaves the composition — but it
  keeps the blur anyway, for a smaller reason: the column is animating itself up
  by the keyboard's height, and clearing focus first lets that settle before the
  auth guard swaps the screen out.
- The keyboard-avoidance story is a single native scrolling container that
  insets its content above the keyboard, rather than hand-managed padding.
- **The choice buttons carry no leading glyph on Android.** The app's Android
  icon vocabulary is a Material *font*, which a Compose button cannot draw — it
  wants an XML vector drawable — and hosting the React Native icon inside the
  button would put a dead spot over it, since the hosted view consumes the tap
  before the button's ripple sees it. The hero and the error notice do host
  their icons that way (nothing there is tappable); the choice buttons instead
  lean on the server's own wording, which names the channel outright ("Text
  message to \*\*\*-1234"). A glyph returns here if Compose vector assets do.

| Concern | iOS | Android |
| --- | --- | --- |
| Keyboard avoidance | Native scroll view keyboard safe area | Compose `verticalScroll` column under `imePadding`, with the window's default `adjustResize`; the focused field asks the scroller to bring it into view |
| Explicit blur before submit | Required (see above) | Kept, but only to settle the IME inset before the unmount |
| Dismissing the keyboard by dragging | Interactive, follows the finger | Not wired: dragging keeps the keyboard up, and the system back gesture dismisses it — the Android convention |
| Screen-change animation | SwiftUI spring on a screen-index dependency | Compose `animateContentSize` on the content column |
| Choice button glyph | Channel icon beside the label | Label only (see above) |
