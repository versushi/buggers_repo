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

// remove_coverage_options.js
//
// Remove LLVM code coverage compiler options from a CCStudio .cproject file, in
// every build configuration, then touch one source file so the IDE reloads the
// edited .cproject.
//
// Usage:
//   node remove_coverage_options.js --cproject <path> --option <flag> [--option <flag>]...
//
// Each <flag> is one of:
//   -fprofile-instr-generate  -fcoverage-mapping  -fmcdc
//   -ffunction-coverage-only  -fprofile-counter-size=<n>
//
// Only the requested options are removed. An option is found in two forms:
//   - a structured <option> whose superClass ends in compilerID.<SUFFIX>
//     (e.g. FCOVERAGE_MAPPING), in any TI Clang compiler tool
//     (TMS470_TICLANG_* for Arm, C2000_TICLANG_* for C29)
//   - a <listOptionValue value="<flag>"/> in the compiler's OTHER_FLAGS option;
//     OTHER_FLAGS is removed too if that leaves it empty
// The preceding newline and indent are removed with each element, so no blank lines
// are left behind. The script is idempotent: with nothing to remove it changes and
// touches nothing and exits 0.
//
// The touch sets the modification time of one source file to now. The IDE only
// reloads an externally edited .cproject when it sees a newer project file.

"use strict";

const fs   = require("fs");
const path = require("path");

const SCRIPT_NAME = "remove_coverage_options.js";

const SUFFIX_BY_FLAG = {
    "-fprofile-instr-generate": "FPROFILE_INSTR_GENERATE",
    "-fcoverage-mapping":       "FCOVERAGE_MAPPING",
    "-fmcdc":                   "FMCDC",
    "-ffunction-coverage-only": "FFUNCTION_COVERAGE_ONLY",
};
const COUNTER_SIZE_RE = /^-fprofile-counter-size=\d+$/;
const COUNTER_SIZE_SUFFIX = "FPROFILE_COUNTER_SIZE";

const COMPILER_TOOL_RE =
    /<tool\b[^>]*superClass="[^"]*(?:TMS470|C2000)_TICLANG_[\d.]+\.exe\.compiler[^"]*"[^>]*>[\s\S]*?<\/tool>/g;
const OTHER_FLAGS_RE =
    /(?:\r?\n[ \t]*)?<option\b[^>]*?superClass="[^"]*\.compilerID\.OTHER_FLAGS"[^>]*?(?<!\/)>([\s\S]*?)<\/option>/g;
const SOURCE_EXTENSIONS = new Set([".c", ".cpp", ".cc", ".asm", ".s"]);

function usageAndExit(message) {
    if (message) {
        console.error("Error: " + message);
    }
    console.error(
        "Usage:\n" +
        "  node " + SCRIPT_NAME + " --cproject <path> --option <flag> [--option <flag>]...\n" +
        "Flags: " + Object.keys(SUFFIX_BY_FLAG).join(" ") + " -fprofile-counter-size=<n>",
    );
    process.exit(1);
}

function parseArgs() {
    // A launcher wrapper may insert an extra entry before the script path, so take the
    // arguments from just after this script's own path.
    const scriptIndex = process.argv.findIndex((a, i) => {
        return i > 0 && path.basename(a) === SCRIPT_NAME;
    });
    const args = process.argv.slice(scriptIndex >= 0 ? scriptIndex + 1 : 2);
    const opts = { cproject: null, flags: [] };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--cproject" && i + 1 < args.length) {
            opts.cproject = args[++i];
        } else if (args[i] === "--option" && i + 1 < args.length) {
            const flag = args[++i];
            if (!SUFFIX_BY_FLAG[flag] && !COUNTER_SIZE_RE.test(flag)) {
                usageAndExit("unknown coverage option: " + flag);
            }
            if (!opts.flags.includes(flag)) {
                opts.flags.push(flag);
            }
        } else {
            usageAndExit("unknown or incomplete argument: " + args[i]);
        }
    }
    if (!opts.cproject) {
        usageAndExit("--cproject is required");
    }
    if (opts.flags.length === 0) {
        usageAndExit("at least one --option is required");
    }
    if (!fs.existsSync(opts.cproject)) {
        console.error("Error: .cproject file not found: " + opts.cproject);
        process.exit(1);
    }
    return opts;
}

function suffixOf(flag) {
    return COUNTER_SIZE_RE.test(flag) ? COUNTER_SIZE_SUFFIX : SUFFIX_BY_FLAG[flag];
}

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Name of the <configuration> element that precedes the given offset.
function configurationAt(content, offset) {
    const re = /<configuration\b[^>]*\bname="([^"]*)"/g;
    let name = "(unknown configuration)";
    let m;
    while ((m = re.exec(content)) !== null && m.index < offset) {
        name = m[1];
    }
    return name;
}

function removeFromTool(toolXml, flag, removeCounter) {
    const re = new RegExp(
        "\\r?\\n[ \\t]*<option\\b[^>]*?superClass=\"[^\"]*\\.compilerID\\." + suffixOf(flag) + "\"[^>]*?\\/>", "g");
    let found = false;
    let result = toolXml.replace(re, () => {
        found = true;
        return "";
    });

    const flagRe = new RegExp(
        "\\r?\\n[ \\t]*<listOptionValue\\b[^>]*?value=\"" +
        (removeCounter ? "-fprofile-counter-size=\\d+" : escapeRe(flag)) + "\"[^>]*?\\/>", "g");
    result = result.replace(OTHER_FLAGS_RE, (optionXml) => {
        const stripped = optionXml.replace(flagRe, () => {
            found = true;
            return "";
        });
        if (stripped === optionXml) {
            return optionXml;
        }
        const body = stripped.slice(stripped.indexOf(">") + 1, stripped.lastIndexOf("</option>"));
        return /<listOptionValue\b/.test(body) ? stripped : "";
    });
    return { xml: result, found: found };
}

function removeOptions(content, flags) {
    const removed = [];
    const result = content.replace(COMPILER_TOOL_RE, (toolXml, offset) => {
        const config = configurationAt(content, offset);
        let xml = toolXml;
        for (const flag of flags) {
            const r = removeFromTool(xml, flag, COUNTER_SIZE_RE.test(flag));
            if (r.found) {
                xml = r.xml;
                removed.push({ flag: flag, config: config });
            }
        }
        return xml;
    });
    return { content: result, removed: removed };
}

function configurationNames(content) {
    const names = new Set();
    const re = /<configuration\b[^>]*\bname="([^"]*)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        names.add(m[1]);
    }
    return names;
}

// First source file under dir, skipping dot-folders and build-output folders.
function findSourceFile(dir, skipNames) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            return full;
        }
    }
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".") && !skipNames.has(entry.name)) {
            const found = findSourceFile(path.join(dir, entry.name), skipNames);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

function main() {
    const opts = parseArgs();
    const content = fs.readFileSync(opts.cproject, "utf-8");
    const result = removeOptions(content, opts.flags);

    for (const r of result.removed) {
        console.log("removed " + r.flag + " from configuration " + r.config);
    }
    for (const flag of opts.flags) {
        if (!result.removed.some((r) => { return r.flag === flag; })) {
            console.log("not found: " + flag);
        }
    }
    if (result.removed.length === 0) {
        console.log("No changes made.");
        return;
    }

    fs.writeFileSync(opts.cproject, result.content, "utf-8");
    console.log("Updated " + opts.cproject);

    const projectDir = path.dirname(path.resolve(opts.cproject));
    const source = findSourceFile(projectDir, configurationNames(content));
    if (source) {
        const now = new Date();
        fs.utimesSync(source, now, now);
        console.log("touched " + source);
    } else {
        console.log("warning: no source file found to touch; the IDE may not reload .cproject");
    }
}

main();
