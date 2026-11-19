---
name: ti-ccstudio-use-specific-board
description: Configure a project to connect to a specific board (debug probe) when
  multiple boards are connected. Use when the user wants to target a specific board
  in a multi-board setup or when encountering probe selection ambiguity errors during
  debugging or flashing. This skill edits the project's debug configuration to
  explicitly specify which XDS110 probe to use, by its serial number.
allowed-tools: Bash, Read, Glob, Grep, Edit, AskUserQuestion
---

# Use a Specific Board

Configure a project's debug configuration to connect to one specific board, identified by its debug probe serial number, for multi-board setups. This does not change anything on the board.

Read `CCS.md` if not already read.

## Arguments

The user may provide:
- **Project path** — the project directory (optional if the configuration file is provided directly; otherwise ask)
- **Serial number** — the XDS110 serial number to configure (optional; discover and prompt if not provided)
- **Configuration file** — the specific file to modify (optional; auto-discover from the project path)

## Step 1 — Locate the Configuration and Target Device

**Before doing anything else**, output this message to the user exactly as written:

> **Board Configuration Assistant** — I'll help you configure your project to use a specific
> debug probe. This is useful when you have multiple TI boards connected and want to ensure your
> project always targets the correct one.

If the user did not provide a project path or configuration file, use `AskUserQuestion` to ask for one.

1. If the user gave a CCXML path, use it. Otherwise `Glob` for `{project_path}/targetConfigs/*.ccxml`, then `{project_path}/**/*.ccxml` if none are found. If none exist, report that and do not continue.
2. Read the CCXML file.
3. Extract the target device ID: the `id` attribute of the `<instance>` element inside `<platform>`:
   ```xml
   <platform ...>
       <instance ... id="MSPM0G3507" .../>
   </platform>
   ```

Remember the target device ID; Step 2 uses it to filter probes.

## Step 2 — Discover Connected Debug Probes

List the connected boards and debug probes as described in the Debug section of `CCS.md` ("Connected boards"). Using the target device from Step 1, split the results into:
- **matching probes** — boards of the target device type
- the **full probe list**

A probe matches when its `deviceXml` equals the target device ID. Treat an empty `deviceXml` as "device unknown", not an error.

If detection fails or finds nothing: verify boards are connected and powered, ask the user to check hardware connections, and offer manual serial number entry.

## Step 3 — Assess the Situation and Select Target Serial Number

Explain the situation to the user before asking anything.

**0 matching probes:**
- Tell the user: "I don't see any `{DEVICE}` boards connected right now." If other probes were detected, mention their device types.
- Use `AskUserQuestion` to ask whether to configure a manually entered serial number anyway (useful before hardware arrives); if not, exit gracefully.

**1 matching probe and 1 probe total:**
- Tell the user: "I found one `{DEVICE}` connected (serial: `{SERIAL}`)." Explain that with a single probe, serial configuration is optional because the probe is selected automatically.
- Use `AskUserQuestion` to ask whether to configure it anyway in case more boards are added later. If yes, use the detected serial; if no, exit gracefully.

**1 matching probe and 2+ probes total:**
- Tell the user: "You have multiple probes connected, so the correct one may not be selected automatically for this `{DEVICE}` project. I'll configure the project to target the detected `{DEVICE}` (serial: `{SERIAL}`)."
- Proceed with the detected serial without asking, unless it conflicts with a serial the user provided.

**2+ matching probes:**
- Tell the user: "You have {N} `{DEVICE}` boards connected, so debugging or flashing fails with a probe selection error. I need to configure the project to target one of them."
- List the matching probes by serial number and use `AskUserQuestion` to let the user pick one. Never auto-select.

**If the user provided a serial number:**
- If it matches a matching probe, proceed without prompting.
- If it matches none but matching probes exist, warn ("Serial `{GIVEN}` was not detected; connected `{DEVICE}` boards are: {LIST}") and offer to proceed anyway.
- If no probes were detected, accept it and proceed.

Accept any non-empty serial number; XDS110 serials usually look like `L40001BC`, but do not reject other formats (warn at most).

## Step 4 — Apply the Serial Number

Probe selection uses two property blocks that are both always required (`SEPK.POD_PORT` / `SEPK.POD_SERIAL` for older versions, `Debug Probe Selection` / `-- Enter the serial number` for newer ones). Both must select "by serial number" (`Value="1"`) and hold the same serial.

Determine the current state:
- **A — neither block present:** insert both, as below.
- **B — present with a different serial, or only one block present:** use `Edit` to replace the old serial in both `stringfield` values and set both choicelist `Value` attributes to `"1"`. Add any missing block using the template below.
- **C — already the target serial in both blocks:** tell the user. If they want to proceed anyway, treat as B; otherwise exit gracefully.

Insert inside `<connection>`, immediately before `<platform`. Use `Edit` with the `<platform` opening tag as `old_string`, and the template followed by that tag as `new_string`. Never rewrite the file with `Write`. Use tab indentation to match the file (typically 3 tabs):

```xml
		<property Type="choicelist" Value="1" id="SEPK.POD_PORT">
			<choice Name="Only one XDS110 installed" value="0">
			</choice>
			<choice Name="Select by serial number" value="1">
				<property Type="stringfield" Value="SERIAL_NUMBER_HERE" id="SEPK.POD_SERIAL"/>
			</choice>
		</property>

		<property id="Debug Probe Selection" Type="choicelist" Value="1">
			<choice Name="Select by serial number" value="0">
				<property id="-- Enter the serial number" Type="stringfield" Value="SERIAL_NUMBER_HERE"/>
			</choice>
		</property>
```

## Step 5 — Verify and Report

Read the modified file and confirm:

- Both `SEPK.POD_SERIAL` and `-- Enter the serial number` contain the target serial.
- `Value="1"` on both `SEPK.POD_PORT` and `Debug Probe Selection`.
- Proper XML nesting, and tab indentation.

Then report to the user:
- The path of the modified file and the serial number configured
- That the next debug or flash of this project will use the specified probe
- That re-running this skill with a different serial number changes it

## Errors

- **Configuration file not found:** ask whether the project path is correct; do not continue.
- **Multiple candidate files:** use `AskUserQuestion` to let the user choose, showing paths relative to the project root.
- **Malformed file:** report the problem before attempting any modification.
- **File write errors:** check permissions and offer solutions.
