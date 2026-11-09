# Changelog

## 0.2.2 — 2026-11-09

### Removed
- "Waiting for you" on a permission prompt. Claude Code hides the band above the prompt while the permission dialog is up, so the wave could never be seen. He still waves for a question or a plan to approve.

## 0.2.1 — 2026-11-09

### Changed
- "Waiting for you" now comes from the permission prompt's notification instead of a permission-check hook, so the mod never takes part in a permission decision.
- README lists what each hook does.

## 0.2.0 — 2026-11-09

### Added
- **Waiting for you:** Clawd waves (`hey!`) while a permission prompt, a question or a plan is waiting on you, and goes back to work the moment an allowed command starts.
- **Compacting:** he squashes flat and springs back while the conversation is summarized.
- **Helpers out:** with several subagents running at once, he shows how many (`3 helpers out`).
- **Bored:** a command that runs past 20 seconds makes him slump and yawn.
- **Settings:** crab color, how long until he dozes off, and whether the status text shows.
- Tests (`claude plugin test .`) and an icon.

## 0.1.0 — 2026-11-08

- First release: Clawd above the prompt, acting out thinking, writing a reply, reading, searching, editing, running, browsing, sending a subagent, errors, done and sleeping. `/crab` hides him.
