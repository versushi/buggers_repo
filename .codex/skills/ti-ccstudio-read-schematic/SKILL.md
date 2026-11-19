---
name: ti-ccstudio-read-schematic
description: Read pin-to-net connectivity from a hardware schematic (Altium SchDoc, ODB++, Eagle XML). Use when you need which net connects to which connector or IC pin.
allowed-tools: Bash, Read, Glob, Grep
---

# Read a schematic

Run `node <skill-dir>/scripts/schematic.cjs --help` for commands and options.


## Workflow

1. `detect <input>`: confirms the format. `<input>` is a file, folder or zip (nested zips are opened).
2. `components <input> --filter connector`: find the refdes you need.
3. `component <input> <refdes>...`: pin-to-net table for only those parts.


## Rules

- A pin marked `⚠ UNRESOLVED` has no proven net. Report it as unknown; never treat it as NC or guess from a part's usual pinout.
- `NC` is shown only when the design explicitly marks the pin no-connect.
- `⚠ AMBIGUOUS` lists the candidate nets; ask the user or check the PDF.
- `→ R18.1` means the pin is wired straight to another part's pin with no named net; follow it with `component`.
- A pin tagged `via R23` is connected through a 0 Ω jumper; mention that when reporting it.
- Pin numbers are the part's designators (as printed on the board), not signal names.
- Rely on the printed table. Do not read the design files yourself.


## Formats

- Altium `.SchDoc`: give all sheets of the project in one folder; connectivity is per sheet label plus ports.
- ODB++: folder or zip.
- Eagle `.sch` (XML).
- PDF: drawing text only, nets are unreliable. Use only to cross-check; ask for the source files.
- OrCAD `.DSN` is not read. `detect` prints which netlist export to request (Capture `.net`, Allegro `.tel`, IPC-D-356).
- Unsupported or unknown input fails with the supported list; do not retry with another tool.


## Output warnings

Any `Warnings:` block under a table means part of the design was skipped or merged (e.g. a part on several sheets). Relay it with the result.
