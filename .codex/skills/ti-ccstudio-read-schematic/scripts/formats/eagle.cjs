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

const path = require("path");
const { STATUS, newDesign, finalizeDesign, isAutoNetName } = require("../lib/model.cjs");

const ID = "eagle";
const LABEL = "Eagle schematic (XML .sch)";

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m]);

function attrs(tag) {
  const out = {};
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tag)) !== null) out[m[1]] = decode(m[2]);
  return out;
}

function detect(files) {
  const found = [];
  for (const f of files) {
    if (!f.path.toLowerCase().endsWith(".sch")) continue;
    let head;
    try {
      head = f.read().subarray(0, 4096).toString("utf8");
    } catch (_) {
      continue;
    }
    if (/<\?xml/.test(head) && /<eagle[\s>]/.test(head)) found.push(f.path);
  }
  if (found.length === 0) return null;
  return { format: ID, label: LABEL, supported: true, confidence: 0.95, files: found, reason: `${found.length} Eagle XML schematic(s)` };
}

/** library|deviceset|device -> { packaged, pads: Map<"gate|pin", pad> } */
function parseLibraries(text) {
  const devices = new Map();
  const libRe = /<library\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/library>/g;
  let lm;
  while ((lm = libRe.exec(text)) !== null) {
    const lib = decode(lm[1]);
    const dsRe = /<deviceset\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/deviceset>/g;
    let dm;
    while ((dm = dsRe.exec(lm[2])) !== null) {
      const ds = decode(dm[1]);
      const devRe = /<device\s+([^>]*?)(\/>|>([\s\S]*?)<\/device>)/g;
      let vm;
      while ((vm = devRe.exec(dm[2])) !== null) {
        const a = attrs(vm[1]);
        const pads = new Map();
        const body = vm[3] || "";
        const cRe = /<connect\s+([^>]*?)\/>/g;
        let cm;
        while ((cm = cRe.exec(body)) !== null) {
          const c = attrs(cm[1]);
          if (c.pad) pads.set(`${c.gate}|${c.pin}`, c.pad);
        }
        devices.set(`${lib}|${ds}|${a.name || ""}`, { packaged: Boolean(a.package) || pads.size > 0, pads });
      }
    }
  }
  return devices;
}

function parseFile(file, design, netNodes, comps) {
  const text = file.read().toString("utf8");
  const devices = parseLibraries(text);
  const sheetName = path.posix.basename(file.path);
  design.source.sheets.push(sheetName);

  const partsBlock = /<parts>([\s\S]*?)<\/parts>/.exec(text);
  if (!partsBlock) throw new Error(`${file.path}: no <parts> section; not an Eagle schematic`);

  const parts = new Map();
  const partRe = /<part\s+([^>]*?)\/?>/g;
  let pm;
  while ((pm = partRe.exec(partsBlock[1])) !== null) {
    const a = attrs(pm[1]);
    const dev = devices.get(`${a.library}|${a.deviceset}|${a.device || ""}`);
    if (!dev || !dev.packaged) continue; // supply symbols, frames and logos have no physical pins
    parts.set(a.name, { attrs: a, dev, pins: new Map() });
  }

  const netsRe = /<net\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/net>/g;
  let nm;
  while ((nm = netsRe.exec(text)) !== null) {
    const netName = decode(nm[1]);
    const prRe = /<pinref\s+([^>]*?)\/>/g;
    let rm;
    while ((rm = prRe.exec(nm[2])) !== null) {
      const r = attrs(rm[1]);
      const part = parts.get(r.part);
      if (!part) continue;
      const pad = part.dev.pads.get(`${r.gate}|${r.pin}`) || r.pin;
      const have = part.pins.get(pad);
      const names = have ? have.nets : new Set();
      names.add(netName);
      part.pins.set(pad, { name: r.pin, nets: names });
      if (!netNodes.has(netName)) netNodes.set(netName, []);
      netNodes.get(netName).push({ refdes: r.part, pin: pad });
    }
  }

  for (const [refdes, part] of parts) {
    const pins = [];
    const all = new Map();
    for (const [key, pad] of part.dev.pads) {
      const [, pinName] = key.split("|");
      all.set(pad, pinName);
    }
    for (const [pad, info] of part.pins) all.set(pad, info.name);
    for (const [pad, pinName] of all) {
      const used = part.pins.get(pad);
      const pin = { number: pad };
      if (pinName && pinName !== pad) pin.name = pinName;
      const provenance = { method: "eagle-net", file: file.path, sheet: sheetName };
      if (used && used.nets.size === 1) {
        pin.net = [...used.nets][0];
        pin.status = STATUS.RESOLVED;
      } else if (used) {
        pin.status = STATUS.AMBIGUOUS;
        pin.candidates = [...used.nets];
      } else {
        pin.status = STATUS.UNRESOLVED;
        provenance.method = "absent-from-netlist";
      }
      pin.provenance = provenance;
      pins.push(pin);
    }
    if (pins.length === 0) continue;
    comps.push({
      refdes,
      part: `${part.attrs.library}/${part.attrs.deviceset}${part.attrs.device ? `/${part.attrs.device}` : ""}`,
      value: part.attrs.value || undefined,
      sheet: sheetName,
      pins,
    });
  }
}

function parse(files) {
  const sch = files.filter((f) => f.path.toLowerCase().endsWith(".sch"));
  const found = detect(sch);
  if (!found) throw new Error("No Eagle XML schematic (.sch with an <eagle> root) found");
  const wanted = new Set(found.files);
  const design = newDesign(ID, found.files);
  const netNodes = new Map();
  for (const f of sch.filter((x) => wanted.has(x.path))) parseFile(f, design, netNodes, design.components);
  for (const [name, nodes] of netNodes) design.nets.push({ name, anonymous: isAutoNetName(name), nodes });
  return finalizeDesign(design);
}

module.exports = { id: ID, label: LABEL, supported: true, detect, parse };
