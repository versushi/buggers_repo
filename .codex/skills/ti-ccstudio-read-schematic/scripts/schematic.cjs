#!/usr/bin/env node
/*
 * TEXAS INSTRUMENTS TEXT FILE LICENSE
 *
 * Copyright (c) 2026 Texas Instruments Incorporated
 *
 * All rights reserved not granted herein.
 *
 * Limited License.
 *
 * Texas Instruments Incorporated grants a world-wide, royalty-free, non-exclusive
 * license under copyrights and patents it now or hereafter owns or controls to
 * make, have made, use, import, offer to sell and sell ("Utilize") this software
 * subject to the terms herein. With respect to the foregoing patent license, such
 * license is granted solely to the extent that any such patent is necessary to
 * Utilize the software alone. The patent license shall not apply to any
 * combinations which include this software, other than combinations with devices
 * manufactured by or for TI ("TI Devices"). No hardware patent is licensed
 * hereunder.
 *
 * Redistributions must preserve existing copyright notices and reproduce this
 * license (including the above copyright notice and the disclaimer and (if
 * applicable) source code license limitations below) in the documentation and/or
 * other materials provided with the distribution
 *
 *
 * Redistribution and use in binary form, without modification, are permitted
 * provided that the following conditions are met:
 *
 * * No reverse engineering, decompilation, or disassembly of this software is
 * permitted with respect to any software provided in binary form.
 *
 * * any redistribution and use are licensed by TI for use only with TI Devices.
 *
 * * Nothing shall obligate TI to provide you with source code for the software
 * licensed and provided to you in object code.
 *
 * If software source code is provided to you, modification and redistribution of
 * the source code are permitted provided that the following conditions are met:
 *
 * * any redistribution and use of the source code, including any resulting
 * derivative works, are licensed by TI for use only with TI Devices.
 *
 * * any redistribution and use of any object code compiled from the source code
 * and any resulting derivative works, are licensed by TI for use only with TI
 * Devices.
 *
 * Neither the name of Texas Instruments Incorporated nor the names of its suppliers
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * DISCLAIMER.
 *
 * THIS SOFTWARE IS PROVIDED BY TI AND TI"S LICENSORS "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL TI AND TI"S LICENSORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { collectFiles, expandHome } = require("./lib/input.cjs");
const { detectAll, load, SUPPORTED_LABELS } = require("./lib/detect.cjs");
const { listComponents, getComponents } = require("./lib/query.cjs");
const { renderDetect, renderComponents, renderComponent, renderWarnings } = require("./lib/render.cjs");

const USAGE = `Usage: schematic.cjs <command> <input> [options]

Reads connectivity (which net is on which pin) from a hardware design.
<input> is a file, a folder or a .zip (nested zips are opened).
Supported: ${SUPPORTED_LABELS.join("; ")}.

Commands:
  detect <input>                       Report the design format(s) found
  components <input>                   List parts (--filter connector|ic|passive, --min-pins N)
  component <input> <refdes>...        Pin-to-net table for the given parts
  export <input> [--out <file>]        Full design as JSON

Options:
  --format <name>   Force a format when the input holds several
  --json            JSON output instead of markdown
  --help            Show this help`;

const COMMANDS = new Set(["detect", "components", "component", "export"]);

function parseArgs(argv) {
  const opts = { positional: [], json: false, format: null, filter: null, minPins: 0, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === "--json") opts.json = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--format") opts.format = value();
    else if (a === "--filter") opts.filter = value();
    else if (a === "--min-pins") opts.minPins = parseInt(value(), 10) || 0;
    else if (a === "--out") opts.out = expandHome(value());
    else if (a.startsWith("--")) throw new Error(`Unknown option ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

function print(text) {
  process.stdout.write(`${text}\n`);
}

function run(argv) {
  const opts = parseArgs(argv);
  const [command, input, ...rest] = opts.positional;
  if (opts.help || !command) {
    print(USAGE);
    return opts.help ? 0 : 1;
  }
  if (!COMMANDS.has(command)) throw new Error(`Unknown command "${command}"\n\n${USAGE}`);
  if (!input) throw new Error(`"${command}" needs an <input> (file, folder or zip)`);

  const files = collectFiles(input);

  if (command === "detect") {
    const hits = detectAll(files);
    const json = JSON.stringify({ input, filesScanned: files.length, formats: hits }, null, 2);
    print(opts.json ? json : renderDetect(input, hits, files.length));
    return 0;
  }

  const design = load(files, opts.format);

  if (command === "export") {
    const text = JSON.stringify(design, null, 2);
    if (opts.out) {
      fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
      fs.writeFileSync(opts.out, `${text}\n`);
      print(`Wrote ${opts.out} (${design.components.length} components, ${design.nets.length} nets)`);
    } else {
      print(text);
    }
    return 0;
  }

  if (command === "components") {
    const rows = listComponents(design, { filter: opts.filter, minPins: opts.minPins });
    print(opts.json ? JSON.stringify(rows, null, 2) : renderComponents(design, rows) + renderWarnings(design));
    return 0;
  }

  if (rest.length === 0) throw new Error('"component" needs at least one reference designator, e.g. component <input> J1');
  const { found, missing } = getComponents(design, rest);
  if (opts.json) {
    print(JSON.stringify({ components: found, missing, warnings: design.warnings }, null, 2));
  } else {
    print(found.map(renderComponent).join("\n\n") + renderWarnings(design));
    if (missing.length) process.stderr.write(`Not found: ${missing.join(", ")}. Run "components" to list what exists.\n`);
  }
  return found.length === 0 ? 1 : 0;
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`Error: ${e.message}\n`);
  process.exitCode = 1;
}
