# hyperbar

A Claude Code mod that puts a glowing progress pill above the prompt while Claude works.

- A black pill with a thin red track stretches across the band above the typing box.
- A glowing red ⚡ thumb rides the track and shows how many tool calls Claude has made. It pops each time the count goes up, and its glow breathes.
- The right end shows the time left when Claude keeps a task list (TodoWrite, or the desktop app's task list), and the elapsed time otherwise.
- Progress follows the task list's finished steps, and creeps forward between tool calls so the bar never sits still. Without a task list it estimates from time and tool calls, and never reaches 100% before the turn ends.
- When the turn finishes the bar fills, turns green with a ✓ and a burst, says `Done · 34s`, and leaves after a few seconds. An interrupted turn goes grey and says `Stopped`.
- Subagents' work does not move the bar.

The desktop app, VS Code and the mobile app draw the pill as an animated SVG. The terminal draws a one-row version in the same colours: `━━━━ ⚡10 ────── ~15m`.

## Install

At the prompt of a terminal session:

```
/plugin install hyperbar --marketplace sharifishti/claude-hyperbar
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```
claude plugin install hyperbar --marketplace sharifishti/claude-hyperbar
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `sharifishti/claude-hyperbar`, then Add plugin. A plugin installed from a terminal at the user scope also loads in the desktop app's sessions.

## Tuning

The desktop app reports the band's width in characters of its code font. `PX_PER_COLUMN` in `hooks/pill.ts` turns that into pixels; raise it if the pill stops short of the right edge, lower it if it runs past.

## Development

```
claude plugin validate .
claude plugin test .
```

## License

MIT
