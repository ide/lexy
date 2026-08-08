# Screen specs

One Markdown file per route, describing what the screen does in platform-neutral
terms. The spec is the contract; the `.ios.tsx` and `.android.tsx` trees are
renderings of it. When the two platforms disagree and the difference is not
written down here, the platform that moved has a bug.

## The mirror invariant

This tree mirrors `src/app` file-for-file, route groups and all:

```
src/app/(tabs)/status/index.tsx  →  specs/(tabs)/status/index.md
src/app/(tabs)/_layout.tsx       →  specs/(tabs)/_layout.md
src/app/sign-in.tsx              →  specs/sign-in.md
```

Every route file has exactly one spec and every spec has exactly one route
file. `mirror.test.ts` in this directory enforces both directions; renaming or
moving a route fails the suite until its spec moves with it. Layouts get specs
because they carry real behavior (the tab set, the auto-refresh policy's
scope). A route that seems to need no spec still needs the sentence saying why
it does nothing.

## Spec template

Sections, in this order — omit a section only when it truly has no content:

- **Route & implementations** — the router path, and which platforms currently
  implement the screen (`iOS ✅ · Android —`).
- **Purpose** — one paragraph.
- **Data** — the hooks/queries the screen reads and the derived values it
  computes, naming the shared modules so both trees pull from the same place.
- **Structure** — an ordered outline of sections/cards/rows and the conditions
  under which each appears.
- **States** — loading/redacted, error, offline, stale-data, and empty
  behavior.
- **Interactions** — taps, pulls, long-presses, the commands they fire, and
  their confirmation flows.
- **Platform notes** — *intentional* divergences, each with a reason. Anything
  not listed here is expected to behave the same on both platforms.

## Working rules

1. A change to a screen's behavior updates its spec **in the same commit**.
2. Building or modifying a screen on either platform starts by reading its
   spec.
3. Divergence is allowed but must be written down under Platform notes; an
   unlisted difference is a bug on whichever platform moved.
4. Specs describe behavior and content, not pixels. Native idiom — SF vs
   Material symbols, popover vs dialog, glass vs tonal buttons — doesn't need
   enumerating unless it changes what the user can do or see.
