# System Patterns (Verified)

## Prefer OS-native primitives over custom daemons
When scheduling reminders/alerts, use **native system capabilities** (e.g., Calendar alarms) instead of custom LaunchAgents where possible.

- Why: fewer background processes, fewer restart loops, better cross-device sync.
- Evidence: WarpJobs “INTERVIEW CALENDAR SYSTEM” best practice notes.

## Keep scoring systems simple and testable
A small tiered scoring system is easier to debug and iterate than a complex weighted model.

- Evidence: WarpJobs “SIMPLIFIED SCORING SYSTEM (5 Tiers)”.

