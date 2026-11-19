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
const os = require("os");
const path = require("path");
const { readZip, isZip } = require("./zip.cjs");

const MAX_ZIP_DEPTH = 3;
const MAX_DIR_DEPTH = 12;
const SKIP_DIRS = new Set([".git", "node_modules", "__MACOSX"]);

function expandHome(p) {
  return p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

/**
 * Turns a file, directory or zip (including zips nested in zips) into a flat
 * list of virtual files: [{ path, read() }]. Paths use "/" separators; entries
 * inside archives are prefixed with the archive's own path.
 */
function collectFiles(input) {
  const root = path.resolve(expandHome(input));
  if (!fs.existsSync(root)) throw new Error(`Input not found: ${input}`);

  const out = [];

  function addZip(display, buf, depth) {
    for (const e of readZip(buf)) {
      const vpath = `${display}/${e.name}`;
      if (depth < MAX_ZIP_DEPTH && e.name.toLowerCase().endsWith(".zip")) {
        let inner;
        try {
          inner = e.read();
        } catch (_) {
          inner = null;
        }
        if (inner && isZip(inner)) {
          addZip(vpath, inner, depth + 1);
          continue;
        }
      }
      out.push({ path: vpath, read: () => e.read() });
    }
  }

  function addFile(full, display) {
    if (full.toLowerCase().endsWith(".zip")) {
      const buf = fs.readFileSync(full);
      if (isZip(buf)) {
        addZip(display, buf, 0);
        return;
      }
    }
    out.push({ path: display, read: () => fs.readFileSync(full) });
  }

  function walk(dir, display, depth) {
    if (depth > MAX_DIR_DEPTH) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      const shown = `${display}/${ent.name}`;
      if (ent.isDirectory()) walk(full, shown, depth + 1);
      else if (ent.isFile()) addFile(full, shown);
    }
  }

  if (fs.statSync(root).isDirectory()) walk(root, path.basename(root), 0);
  else addFile(root, path.basename(root));

  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

module.exports = { collectFiles, expandHome };
