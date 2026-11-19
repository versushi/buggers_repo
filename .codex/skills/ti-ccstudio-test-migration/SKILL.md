---
name: ti-ccstudio-test-migration
description: Verify or test a completed embedded migration on hardware. ALWAYS
  invoke this skill when the user asks to test, verify, or validate a migration
  produced by `ti-ccstudio-migrate-to-ti`, in a workspace containing a
  `migration-report.md`. It builds a hardware test plan tailored to the user's
  available equipment and testing approach, then drives an interactive
  run/fix/rebuild loop against it, tracking progress so testing is resumable
  across sessions. Invoke in the migrated workspace. Do NOT invoke to perform a
  migration itself — that is `ti-ccstudio-migrate-to-ti`.
allowed-tools: Bash, Read, Glob, Grep, Edit, AskUserQuestion, Agent
---

# Test a Migration on Hardware

You are the **orchestrator** for this skill. You delegate every content-heavy
step to a sub-agent with a fresh context. You never load the migration
artifacts in full or board `AGENTS.md` yourself — the planner and executor do
that. Your job is: detect resume state, print the disclaimer,
gather the capability inventory (the mode/resources bundle Step 3 builds),
(with a bench instrument) dispatch the instrument profiler, dispatch the
planner, (for a generated framework) dispatch the instrument integrator and
the framework generator and gate any installs on the
user's permission, confirm wiring, dispatch the executor, surface
failures, and finalize.

Two files carry state between steps and across sessions — you do not hold
this state in context. Both live inside `{project_dir}` — the CCS project
directory the migrate skill created (`project_dir = {workspace}/<Project
Name>`, derived from the migrate skill's `{workspace}/migration-plan.md` top-
level `## Project Details` — see Step 1):

- `migration-test-plan.md` — the static test plan (cases, wiring, pass
  criteria). The **Test Planner** writes it; the user may edit it; you dispatch
  from its `## Test Sequence`.
- `migration-test-report.md` — the runtime record (results + fixes). The
  **Test Executor** creates and appends to it. Its `## Test Checklist` is the
  **resume contract**.

These sit alongside the migrate skill's `migration-report.md` in the same
`{project_dir}`, which this skill **reads** (for context) and, at the end,
**ticks** (`- ⬜ Tested on hardware` + `Status:`) so the migrate resume
contract stays intact. The migrate skill's `migration-plan.md` itself stays at
the workspace root (it's the stable, non-circular pointer to `project_dir` —
see Step 1).

## Sub-agent invocation

Each sub-agent has a self-contained prompt under `agents/<name>.md` (relative to
this SKILL.md). Dispatch is a **trampoline** — do **not** read the prompt file
yourself; the sub-agent reads it in its own fresh context.

To dispatch, call the `Agent` tool with `subagent_type: "general-purpose"` and a
prompt of the form, substituting `{skill_dir}` with the actual path where you
installed this skill (e.g. `.claude/skills/ti-ccstudio-test-migration` for
Claude Code, `.qwen/skills/ti-ccstudio-test-migration` for Qwen):

```
Read the file `agents/<name>.md` relative to this skill's SKILL.md
(workspace path: `{skill_dir}/agents/<name>.md`).
That file is your authoritative instructions — read it in full and follow it
exactly. The structured input bundle for this invocation is below.

--- INPUT BUNDLE ---
<bundle markdown>
--- END INPUT BUNDLE ---
```

Then parse the sub-agent's structured return value by header (`## PlanResult`
from the planner, `## ProfileResult` from the instrument profiler,
`## IntegrationResult` from the instrument integrator, `## GenerateResult`
from the framework generator, `## TestResult` from the executor).

**All sub-agents run sequentially. Never spawn two at once.** The executor owns
a live debug session and shared MCP state; concurrent agents corrupt it and the
artifacts.

**Dispatch failures and retries.** Every return block has a `status`
(`success | failed`, plus `needs_profile` for the integrator). With
`status: failed`, its `notes_for_orchestrator` says what happened, what the
sub-agent tried, and what it recommends you do — whether the failure was in
the operation itself or a tool it could not use. A sub-agent can never call
`AskUserQuestion` itself, so anything only the user can resolve (a missing
tool, a permission, a decision) arrives this way too.

- **The `Agent` call itself failed** (errored, was cut off, or timed out, so
  there is no return block): re-dispatch the same bundle, up to 3 attempts in
  total, then stop and report what failed.
- **The sub-agent returned `status: failed`:** if `notes_for_orchestrator`
  describes something you can deal with (a message to show the user verbatim,
  a question to ask, a prerequisite to fix), do it, then re-dispatch with a
  note describing what changed. If that re-dispatch fails for the same
  reason, or there is nothing you can do, show the user the `summary` and
  `notes_for_orchestrator` (including any message it asks you to show
  verbatim) and stop.

Stopping leaves `migration-test-plan.md` / `migration-test-report.md` on disk
for a later resume via Step 1. Never do the sub-agent's job yourself as a
substitute. **Exceptions:** an `instrument-profiler` or
`instrument-integrator` failure (a `status: failed` return or an errored /
cut-off dispatch) is never retried automatically — the user decides how to
proceed (see Steps 4 and 6). Step 6 (generator install permission) and
Step 7 (`blocked` tests) also ask the user first. A re-dispatch the user
chose in those steps does not count as the retry above.

**Dispatch bundles are tiny.** Every sub-agent reads its content from the
artifacts itself. You pass only small resolved values (the capability
inventory and instrument profile path to the planner; the instrument name
to the profiler; the language and framework to the integrator; the
language, framework, and approved installs to the generator; only an
optional `retry_context` to the executor). Never read an instrument profile yourself —
pass its path.

## Step 1 — Detect a resumable test session

**Retrospective hook (always runs first, regardless of path below).** If the
user's original request mentions "retrospective" (any case), invoke
`/ti-ccstudio-internal-retrospective` now, before branching on Resume/Start
over/Abort below.
It only sets up collection — continue this skill's steps immediately after.

Run `pwd` → `{workspace}`. Check whether `{workspace}/migration-plan.md`
(the **migrate** skill's plan, not this skill's test plan) exists (Bash
`test -f`).

- **Absent** → stop: "No migration found in this workspace — run this skill
  in a workspace that already contains a migration produced by the
  `ti-ccstudio-migrate-to-ti` skill." Do not proceed.
- **Present** → read its top-level `## Project Details` **Project Name** row
  and derive `{project_dir} = {workspace}/<Project Name>`. Check whether
  `{project_dir}/migration-report.md` exists (Bash `test -f`).
  - **Absent** → stop: "No migration found in this workspace — run this skill
    in a workspace that already contains a `migration-report.md` produced by
    the `ti-ccstudio-migrate-to-ti` skill." Do not proceed.
  - **Present** → check whether `{project_dir}/migration-test-plan.md` exists
    (Bash `test -f`).

    - **It exists** → a test plan is already on disk. Ask with
      `AskUserQuestion`:

      ```
      question: "A hardware test plan already exists in this workspace. Resume it?"
      options:
        - label: "Resume"
          description: "Continue from the first unfinished test in the checklist"
        - label: "Start over"
          description: "Erase the existing test plan and report, then plan fresh"
        - label: "Abort"
          description: "Stop here; leave the existing test artifacts untouched"
      ```

      On **Resume**, read `{project_dir}/migration-test-plan.md`'s
      `## Test Strategy` **Mode** line, then branch:
      - `Mode: existing-tests`, or `Mode: create-tests` where
        `{project_dir}/migration-test-report.md` already exists (a framework
        was generated and Step 7 already began) → skip Steps 2–5 entirely
        (the plan is authoritative — do not re-run the planner) and go to
        Step 7, computing the resume point from
        `{project_dir}/migration-test-report.md`'s `## Test Checklist`.
      - `Mode: create-tests` with no report yet (the user previously chose
        "Stop here" at the Step 5 gate, or a Tweak loop was mid-flight) →
        skip Steps 2–4 and re-enter the **Step 5 gate** (re-print the plan
        as "Present the plan" describes and ask Generate/Tweak/Stop
        again) — jumping straight to Step 7 here would attempt to dispatch a
        framework that was never generated.

      On **Start over**, delete `{project_dir}/migration-test-plan.md` and
      `{project_dir}/migration-test-report.md` (Bash `rm -f`, if present),
      then continue to Step 2 so the planner writes a fresh plan. On
      **Abort**, end the session now; the existing artifacts are left on disk
      untouched.

    - **It does not exist** → a fresh test session. Continue to Step 2.

## Step 2 — Disclaimer, read migration context

Output this message to the user exactly as written:

> **Migration Test Assistant** — I'll help you verify this migration on
> hardware. Please note this is an AI-assisted process. **Hardware can be
> damaged by incorrect wiring** — reversed polarity, a signal pin tied to a
> supply rail, or mismatched voltage levels can destroy a board. Before
> powering or running anything, confirm every connection (jumper wires,
> logic-analyzer/signal-generator channels, loopback cables) against your board
> schematic. I will pause for you to make and confirm the connections once,
> before any test runs.

Then read **only** the compact context you need — do **not** read board
`AGENTS.md` or SDK guides (that is the planner's job; keep your own context
lean for the long test session ahead):

- `{project_dir}/migration-report.md` `## Project Details` (target/board/SDK,
  project name).
- Derive `target_config_mechanism` (SysConfig vs DeviceTree/Kconfig) from
  `{workspace}/migration-plan.md`'s `## Sequence`: a `sysconfig-configurator`
  step ⇒ `SysConfig`; a `devicetree-configurator` step / a `west build` Build
  command ⇒ `DeviceTree/Kconfig`. Use it to set expectations (Zephyr targets
  have limited hardware-debug automation).

## Step 3 — Mode and resources

1. Identify the connected probe(s)/board as the central guide's Debug section
   describes for connected boards. Mention what you found to the user.
2. `AskUserQuestion` — **testing mode**:

   ```
   question: "What would you like help with?"
   options:
     - label: "I have existing tests"
       description: "Run them, debug any failures, and fix what's found"
     - label: "Help me create a test plan"
       description: "I don't have tests yet and want a plan built for me"
   ```

   Capture as `Mode: existing-tests | create-tests` (in the order the
   options are listed above).

3. **`Mode: existing-tests`** → ask "How do I run your tests?" — the
   command(s), framework, working directory, the pass/fail signal (exit
   code or output string), and the connections and jumper settings the
   tests need. Capture as `existing_test_howto`
   (free-text, captured verbatim for the planner). Skip step 4 below.

4. **`Mode: create-tests`** → `AskUserQuestion`:

   ```
   question: "What hardware do you have available for testing?"
   header: "Hardware"
   multiSelect: true
   options:
     - label: "JTAG access"
     - label: "Serial access"
     - label: "Bench instrument"
       description: "Oscilloscope, logic analyzer, or signal generator"
   ```

   If **Bench instrument** is selected, `AskUserQuestion` for its make and
   model:

   ```
   question: "Which bench instrument do you have?"
   header: "Instrument"
   options:
     - label: "Digilent Analog Discovery 3 (Recommended)"
       description: "USB oscilloscope, logic analyzer, and waveform generator"
     - label: "Saleae Logic"
       description: "USB logic analyzer"
   ```

   A free-text "Other" reply is always available from the tool — the user
   may name any make and model. Capture the reply verbatim as
   `instrument: <name>`. Only one instrument is supported per run; if the
   user names several, ask which one to use.

   Capture the selected subset plus any free-text note (a free-text "Other"
   reply is always available from the tool for anything not listed) as
   `Resources: <subset of jtag, serial, instrument> + free text`. The language/test-
   framework choice is not asked here — it is moot until a framework is
   actually chosen, so it moves to Step 6.

Assemble the detected devices plus `Mode` / `Resources` / `instrument` /
`existing_test_howto` into the dispatch bundle for the planner.

## Step 4 — Profile the instrument (only when `Resources` include `instrument`)

Dispatch `agents/instrument-profiler.md`:

```
- workspace: {workspace}
- instrument: <captured in Step 3>
```

Wait for `## ProfileResult`.

- **`status: success`** → print `summary` and keep `profile_path` as
  `instrument_profile` for the planner bundle.
- **`status: failed`** (or an errored / cut-off dispatch) → show
  `notes_for_orchestrator` and `AskUserQuestion`:

  ```
  question: "Instrument research failed. How would you like to proceed?"
  options:
    - label: "Retry research"
      description: "Re-dispatch the profiler (e.g. after fixing web access)"
    - label: "Plan without an instrument profile"
      description: "Instrument cases are planned without knowing what the instrument supports"
    - label: "Abort"
      description: "Stop here; nothing has been written yet"
  ```

  On **Retry research**, re-dispatch with the same bundle and handle its
  return the same way. On **Plan without an instrument profile**, continue
  to Step 5 with no `instrument_profile`. On **Abort**, stop.

## Step 5 — Plan the tests

Dispatch `agents/test-planner.md` with a tiny bundle:

```
- workspace: {workspace}
- mode: <existing-tests | create-tests>
- resources: <the resource inventory — create-tests only>
- instrument: <the instrument make/model — only when resources include instrument>
- instrument_profile: <profile_path from Step 4 — only when Step 4 returned one>
- existing_test_howto: <existing-tests only; the run command, pass/fail signal, and connections>
```

The planner reads the artifacts / board `AGENTS.md` itself and
writes `{project_dir}/migration-test-plan.md`. Wait for `## PlanResult`,
applying "Dispatch failures and retries" on failure.

**Present the plan.** Read `## Test Strategy`, `## Fixed Wiring Setup`, and
`## Test Sequence` from `{project_dir}/migration-test-plan.md`, print a
summary that names every `stub` case with its `Stub reason`, and print
`## Fixed Wiring Setup` in full. When
`## Fixed Wiring Setup` has a `Target IO voltage` line marked `estimated`,
include it in the summary with its `Target IO voltage source` and a note that
it is an estimate to check against the board before any test runs. Then
branch the gate on `Mode`:

- **`existing-tests`** → `AskUserQuestion`:

  ```
  question: "Proceed with this test plan?"
  options:
    - label: "Proceed"
      description: "Start running the tests"
    - label: "Tweak the plan"
      description: "Drop a test, change wiring/equipment assumptions, reorder, etc."
    - label: "Abort"
      description: "Stop here; keep the test plan for later"
  ```

  On **Tweak**, collect the user's free-text feedback, then re-dispatch the
  planner with the same bundle plus a `user_feedback` block. (The user may
  also hand-edit `migration-test-plan.md` — either way the revised plan is
  on disk.) Re-read and re-print the plan as above, then ask again. Loop
  until Proceed/Abort. On **Proceed**, continue to **Step 7**. On **Abort**, stop;
  the test plan is kept for later.

- **`create-tests`** → `AskUserQuestion`:

  ```
  question: "What would you like to do with this test plan?"
  options:
    - label: "Generate a test framework"
      description: "Scaffold a standalone, runnable test suite from this plan"
    - label: "Tweak the plan"
      description: "Drop a test, change wiring/equipment assumptions, reorder, etc."
    - label: "Stop here"
      description: "I'll test this myself, or run the skill again later to get your help with it"
  ```

  On **Tweak**, collect the user's free-text feedback, then re-dispatch the
  planner with the same bundle plus a `user_feedback` block. (The user may
  also hand-edit `migration-test-plan.md` — either way the revised plan is
  on disk.) Re-read and re-print the plan as above, then ask again. Loop
  until Generate/Stop. On **Generate a test framework**,
  continue to **Step 6**. On **Stop here**, tell the user the plan on disk
  is a checklist/reference they can run at their leisure, and that they may
  re-invoke this skill later to pick this back up, then **stop** (do not run
  Steps 6–8).

## Step 6 — Generate the test framework (when chosen at the Step 5 gate)

`AskUserQuestion` for the language and framework choice:

```
question: "Which language and test framework would you like to use?"
options:
  - label: "JavaScript with Mocha"
    description: "Recommended — Node included with CCStudio"
  - label: "Python with pytest"
```

A free-text "Other" reply is always available from the tool for anything not
listed (e.g. "JavaScript with Jest", "Go", "C#/NUnit") — the generator
supports any language/framework, generating a small debug-bridge script when
the target-access mechanism can't be called from the language directly (see
`test-framework-generator.md`'s Fixed Requirement 2). Capture the reply
verbatim as `Language:` / `Framework:`.

**1. Toolchain check.** Run quick read-only version checks (Bash) for the
chosen language's interpreter and package manager — e.g. `npm --version` for
JavaScript (the bundled Node.js has no npm), `python --version` and
`python -m pip --version` for Python (try `python3` if `python` is absent),
the equivalent commands for any other language. The test framework itself is
installed project-locally by the generator, so it needs only the package
manager. Record each missing tool as
`<tool> — <install method> — <install source> — auto-installable: no`.

**2. Instrument integration** — only when some case in the plan's
`## Test Sequence` has `instrument` in its `Resources` row (check with
`Grep`). Dispatch `agents/instrument-integrator.md` (it reads the
instrument and its profile from the plan):

```
- workspace: {workspace}
- language: <captured above>
- framework: <captured above>
```

Wait for `## IntegrationResult`.

- **`status: needs_profile`** (the plan names no usable instrument profile)
  → dispatch `agents/instrument-profiler.md` with `workspace` and
  `instrument: <the result's instrument>`, and wait for `## ProfileResult`.
  On success, re-dispatch the integrator with the same bundle plus
  `instrument_profile: <profile_path>` and handle its return as in this
  item. A profiler failure is handled like an integrator `status: failed`
  below, except that **Retry research** re-dispatches the profiler. A
  second `needs_profile` is handled like `status: failed` with the notes
  "no instrument profile could be recorded in the plan".
- **`status: failed`** (or an errored / cut-off dispatch) → show
  `notes_for_orchestrator` and `AskUserQuestion`:

  ```
  question: "Instrument research failed. How would you like to proceed?"
  options:
    - label: "Retry research"
      description: "Research the instrument again (e.g. after fixing web access)"
    - label: "Continue without instrument automation"
      description: "Generate the framework; instrument cases become skipped placeholders"
    - label: "Abort"
      description: "Stop here; the plan stays on disk for a later resume via Step 1"
  ```

  On **Retry research**, re-dispatch with the same bundle and handle its return the
  same way. On **Continue**, set
  `instrument_disabled_reason: instrument research failed: <one-line gist of notes_for_orchestrator>`
  and go to item 3 with only the toolchain items. On **Abort**, stop.
- **`status: success`** → print `summary`. If `wiring_changed: true`, re-read
  `## Fixed Wiring Setup` and print it again, telling the user the instrument
  channel names and/or target IO voltage were corrected. Add every
  `missing_prereqs` line to the missing list.

**3. Install-permission gate** — only when the missing list (toolchain items
plus integrator `missing_prereqs`) is non-empty. Print every item with its
install method and install source, then `AskUserQuestion`, offering only the
options whose condition holds:

```
question: "These components are needed and not installed. How would you like to proceed?"
options:
  - label: "Install them for me"          # only if every item is auto-installable: yes
    description: "The generator installs them with the commands shown"
  - label: "I'll install them myself"
    description: "Install them now, then tell me when you're done"
  - label: "Continue without instrument automation"   # only if every item comes from missing_prereqs
    description: "Instrument tests become skipped stubs; nothing is installed"
  - label: "Abort"
    description: "Stop here; the plan stays on disk for a later resume via Step 1"
```

- **Install them for me** → `approved_installs` = every item (component and
  install method).
- **I'll install them myself** → `AskUserQuestion` "Done" / "Abort". On
  **Done**, re-run the toolchain checks and, if the integrator ran,
  re-dispatch it with the same bundle plus `recheck: true`; rebuild the
  missing list from the results and repeat this gate (it is skipped once the
  list is empty).
- **Continue without instrument automation** → set
  `instrument_disabled_reason: user chose not to install <items>`.
- **Abort** → stop.

A recheck dispatch that fails is handled as in item 2.

**4. Generate.** Dispatch `agents/test-framework-generator.md`:

```
- workspace: {workspace}
- language: <captured above>
- framework: <captured above>
- approved_installs: <the approved items, one per line, or none>
- instrument_disabled_reason: <only when set above>
```

Wait for `## GenerateResult`.

- **`status: failed` and `notes_for_orchestrator` asks permission to
  install a component** (one the generator needs that isn't installed and
  wasn't approved) → show the notes and `AskUserQuestion`, offering
  **Allow install** only when they give a command-line install method:

  ```
  question: "<the component, and how it would be installed>"
  options:
    - label: "Allow install — retry"
      description: "Let the generator install it with the method shown"
    - label: "Installed myself — retry"
      description: "Re-dispatch the generator now that it's available"
    - label: "Abort"
      description: "Stop here; the plan stays on disk for a later resume via Step 1"
  ```

  On **Allow install — retry**, add the component and its install method to
  `approved_installs` and re-dispatch; on **Installed myself — retry**,
  re-dispatch with the same bundle. Handle the return via this same
  procedure — this does not count against "Dispatch failures and retries".
  On **Abort**, stop; leave the plan on disk for a later resume via Step 1.

- Any other `status: failed` → apply "Dispatch failures and retries".

Print the `summary` (spec count, stub count), plus `test_project_dir`, to the
user, then continue straight to **Step 7** — choosing to generate a framework
already implies wanting the run/fix/rebuild loop against it, so no further
confirmation gate is needed here.

## Step 7 — Execute the Test Sequence

Read `## Test Sequence` from `{project_dir}/migration-test-plan.md`.

**Checklist states.** In the report's `## Test Checklist`, `✅` is done
(passed, `stub`, or accepted by the user), `⏭` was skipped by the user, and
`⬜` is pending. The executor works out the pending cases itself from the
checklist; you never pass it a list of cases.

**Resume rule.** On any entry to this step, check whether
`{project_dir}/migration-test-report.md` exists yet.

- **It exists** (every `existing-tests` run, and any `create-tests` run past
  its first Step 7 entry) → `Grep` its `## Test Checklist` for `⬜`. If no
  line is `⬜`, go straight to Step 8.
- **It does not** (a `create-tests` plan whose framework has just been
  generated, and Step 7 is beginning for the first time) → every case is
  pending; the `test-executor` dispatch below creates the report itself
  before running anything.

The executor is idempotent — a re-dispatched already-passed case is safe.

1. **Confirm wiring once.** Before the first executor dispatch on this
   Step-7 entry (whether reached fresh from Step 5 or 6 or via a Step 1
   resume), print `## Fixed Wiring Setup` in full. If any `auto` case's
   `Execution` uses an output verb (`generate-signal` or `drive-digital`)
   and the `Target IO voltage` line is marked `estimated`, also print:

   > Signal outputs are limited to `<Target IO voltage>` — an estimate from
   > `<Target IO voltage source>`. Check this against your board schematic
   > before continuing.

   Then `AskUserQuestion` **once**:

   ```
   question: "Make the connections described in Fixed Wiring Setup above. Ready?"
   options:
     - label: "Done"
       description: "Run every test unattended from here — no further wiring prompts this session"
     - label: "Abort"
       description: "Stop here; artifacts stay on disk for a later resume"
   ```

   If the user instead replies (free text) with a corrected IO voltage:
   `Edit` the plan's `Target IO voltage` line to the new value without the
   `estimated` marker and set `Target IO voltage source: user`; then, when
   `## Fixed Wiring Setup` has a `Target IO voltage config:` line, `Edit`
   the value it names in that file (under the plan's `Test project dir`)
   to the same voltage, updating its source comment and removing its
   estimate warning. Print the change and ask this question again.

   This fires once **per Step-7 entry**, not once ever — a resumed session
   re-confirms. No further wiring prompt fires within this same Step-7
   entry.

2. **Dispatch `test-executor`** once:

   ```
   - workspace: {workspace}
   - retry_context: <optional — see "Handle the return">
   ```

   The executor reads `Mode` from the plan and the pending cases from the
   checklist itself, builds the project, runs the cases, does the fix loop,
   and ticks each as it passes (or, for `stub` cases, records it immediately
   without running).

3. **Handle the return** (`## TestResult`):
   1. Print `summary` (and any `fixes_applied`) to the user.
   2. `Grep` `{project_dir}/migration-test-report.md` for `⬜` lines rather
      than reading the whole file. The run is **complete** only if
      `status: success` **and** no line is `⬜` — this also catches a case
      the executor's final full run regressed.
   3. If complete → continue to Step 8.
   4. If any `results` entry has `verdict: blocked` (a deferred fix — there
      may be **more than one**, e.g. an unavailable instrument and a
      pin-reassignment recommendation) → for **each** one, surface that
      test's recommendation (its `notes`) and `AskUserQuestion` **per test**:
      - **Apply the fix** → the user approves the deferred fix.
      - **Skip this test** → `Edit` its checklist line `⬜` → `⏭` and note it
        skipped by the user in `## Results`.
      - **Accept as-is** → you tick that case `✅` and note it accepted in
        `## Results`.

      When the test's `notes` start with `InstrumentUnavailable:`, the fix is
      the user's to make (connect the instrument, install its runtime, close
      another program holding it) — offer instead:
      - **Fixed — retry** → the user reports the instrument issue resolved.
      - **Skip this test** → as above.

      Once every blocked test is answered, if any was **Apply the fix** or
      **Fixed — retry**, re-dispatch the executor once, with a
      `retry_context` that names each of those cases, says what the user
      approved or resolved for each, and limits the run to them. This
      re-dispatch doesn't count against "Dispatch failures and retries" —
      the user's choice drives what happens next, not a retry budget.
   5. If `status: failed` with any `fail` verdict, or with no verdicts at all
      (the executor could not run) → apply "Dispatch failures and retries",
      using `retry_context` for the note describing what changed. When item
      4 also re-dispatches, make one dispatch whose `retry_context` covers
      both. Handle each re-dispatch's return via this same procedure,
      starting again at "Print `summary`" above.
   6. If `status: success` but a case the executor reports as passed, or
      one it should have run (every pending case, or those `retry_context`
      limited it to), is still `⬜` → re-dispatch once with `retry_context`
      naming those cases, and handle its return the same way. If they are
      still `⬜`, stop. Artifacts stay on disk for a later resume via Step 1.
   7. A `stub` verdict is recorded `⚪ STUB` and ticked immediately by the
      executor — it never triggers a retry, a blocked prompt, or a `failed`
      result on its own.

## Step 8 — Finalize

When all cases are `✅` (passed, `stub`, or user-accepted) or `⏭`
(user-skipped), or the user accepts the remaining failures:

1. Set `{project_dir}/migration-test-report.md`'s top **Status:** line to
   `🟢 **COMPLETE**`.
2. **Flip the migrate report** (`{project_dir}/migration-report.md`), so the
   migrate resume contract stays intact:
   - `- ⬜ Tested on hardware` → `- ✅ Tested on hardware` (exact-string
     Edit) — only when at least one test actually passed on hardware. If every
     case was skipped/declined, leave it unticked.
   - Set its top **Status:** line to `🟢 **COMPLETE**`.
3. Print a summary: **N passed / M failed-accepted / K fixes applied**, and
   point the user to `migration-test-report.md` for the per-test results and
   fix log.
4. **If any fixes were applied during this run** (K > 0), list the changes made
   (from the accumulated `## Fixes Applied` — read it from
   `{project_dir}/migration-test-report.md`), and recommend the user review
   them. If no fixes were applied, say so.
5. List every `stub` case (its `⚪ STUB` row in `## Results`) and every case
   the user skipped (`⏭` in `## Test Checklist`): they were not exercised on
   hardware, so the user can check them by hand.
6. **For `Mode: create-tests`**, note that the generated test command (from
   the test project's `README.md`) is now something the user can re-run
   independently going forward, without Claude present.

If the session ends mid-run before all cases resolve, the test plan and
partial report remain on disk; a later invocation resumes via Step 1.

## Invariants

These load-bearing rules hold across every step — named here for reference,
each fully stated where cited:

- **Sub-agents never prompt the user** (see Step 7 item 1 — the orchestrator
  confirms wiring, never a dispatched sub-agent).
- **Sub-agents run one at a time** (see "Sub-agent invocation", above).
- **One wiring setup for every case, confirmed once per Step-7 entry** (see
  Step 7 item 1).
- **`stub` cases are not a pass/fail outcome** (see Step 7 item 3.7).
- **A `blocked` test defers to the user, and never counts against the
  one-retry budget** (see Step 7 item 3.4).
- **One test-artifact set per project, inside `{project_dir}`** (see the
  intro, above).
