# Queue

What would make sense to do next in Lexy. Add an item when you find something worth doing, and delete it when it lands.

- **The connectivity alert disappears for a second on every return to Status** (2026-11-11). Going back and forth between tabs, an alert that Status already showed is hidden for about a second each time Status comes back. Status draws its warning banner only while it is the top screen (`warningsVisible` in `exact/lexy/app.contract`), and the `warningSettled` task waits one visible second, keyed by the visit (`top(nav).id`), before it confirms a refresh failure or a session refusal, so each return counts that second again. The second is the state machine's quiescence before it decides that there is a connectivity problem; once it has decided, the banner should be stable, shown at once when Status comes back. Showing the alert only on Status is fine.
