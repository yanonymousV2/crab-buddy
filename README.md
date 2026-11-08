# crab-buddy

**Meet your crab buddy, in your terminal.** Clawd, Claude Code's mascot, sits in the band just above the prompt and acts out what Claude is doing:
thinking, writing a reply, reading files, searching, editing, running commands, browsing the web,
sending a subagent, hitting an error, finishing a turn, and dozing off after 90 seconds idle.
The file, command or query in progress shows beside it.

![Clawd reading, searching, editing, running a command, finishing and dozing off](assets/crab-buddy.gif)

- It shows from session start; `/crab` hides it or brings it back (ctrl+x ctrl+a collapses the band too).
- It never blocks or changes a tool call.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install crab-buddy --marketplace yanonymousV2/crab-buddy
```

Answer `y` to add the marketplace, then pick a scope (user installs it for every session).

From a shell:

```
claude plugin install crab-buddy --marketplace yanonymousV2/crab-buddy
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with
`yanonymousV2/crab-buddy`, then Add plugin.

## License

MIT

---

Unofficial fan project, not affiliated with or endorsed by Anthropic. Clawd is Claude Code's mascot.

[Play with the demo in your browser →](https://yanonymousv2.github.io/yeshasvi/crab-buddy/#demo)
