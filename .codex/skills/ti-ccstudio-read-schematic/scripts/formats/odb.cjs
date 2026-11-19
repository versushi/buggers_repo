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

const { STATUS, newDesign, finalizeDesign, isAutoNetName } = require("../lib/model.cjs");

const ID = "odb";
const LABEL = "ODB++ (netlist and component layers)";

const NETLIST_RE = /^(.*?)steps\/([^/]+)\/netlists\/cadnet\/netlist$/;
const COMP_RE = /^(.*?)steps\/([^/]+)\/layers\/(comp_\+_(?:top|bot))\/components$/;

function findSteps(files) {
  const steps = new Map();
  for (const f of files) {
    const n = NETLIST_RE.exec(f.path);
    if (n) {
      const key = `${n[1]}steps/${n[2]}`;
      if (!steps.has(key)) steps.set(key, { key, step: n[2], netlist: null, layers: [] });
      steps.get(key).netlist = f;
      continue;
    }
    const c = COMP_RE.exec(f.path);
    if (c) {
      const key = `${c[1]}steps/${c[2]}`;
      if (!steps.has(key)) steps.set(key, { key, step: c[2], netlist: null, layers: [] });
      steps.get(key).layers.push({ name: c[3], file: f });
    }
  }
  return [...steps.values()].filter((s) => s.netlist);
}

function detect(files) {
  const steps = findSteps(files);
  if (steps.length === 0) return null;
  const withComps = steps.filter((s) => s.layers.length > 0);
  if (withComps.length === 0) {
    return {
      format: ID,
      label: LABEL,
      supported: true,
      confidence: 0.3,
      files: steps.map((s) => s.netlist.path),
      reason: "ODB++ netlist found but no component layers (comp_+_top / comp_+_bot); pin-to-net mapping needs them",
    };
  }
  return {
    format: ID,
    label: LABEL,
    supported: true,
    confidence: 0.95,
    files: withComps.flatMap((s) => [s.netlist.path, ...s.layers.map((l) => l.file.path)]),
    reason: `ODB++ step "${withComps.map((s) => s.step).join(", ")}"`,
  };
}

function parseNetlist(text) {
  const nets = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\$(\d+)\s+(\S+)/.exec(line);
    if (m) nets.set(parseInt(m[1], 10), m[2]);
  }
  return nets;
}

function parseComponents(text, layerName) {
  const comps = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    const cmp = /^CMP\s+\S+\s+\S+\s+\S+\s+\S+\s+[NM]\s+(\S+)/.exec(t);
    if (cmp) {
      cur = { refdes: cmp[1], layer: layerName, props: {}, pins: [] };
      comps.push(cur);
      continue;
    }
    if (!cur) continue;
    const prp = /^PRP\s+(\S+)\s+'(.*)'/.exec(t);
    if (prp) {
      cur.props[prp[1]] = prp[2];
      continue;
    }
    const top = /^TOP\s+\S+\s+\S+\s+\S+\s+\S+\s+[NM]\s+(-?\d+)\s+\S+\s+(\S+)/.exec(t);
    if (top) cur.pins.push({ netIndex: parseInt(top[1], 10), number: top[2] });
  }
  return comps;
}

function parse(files) {
  const steps = findSteps(files).filter((s) => s.layers.length > 0);
  if (steps.length === 0) throw new Error("No ODB++ step with netlists/cadnet/netlist and comp_+_top / comp_+_bot layers found");

  const picked = steps[0];
  const design = newDesign(ID, [picked.netlist.path, ...picked.layers.map((l) => l.file.path)]);
  design.source.sheets.push(picked.step);
  if (steps.length > 1) {
    design.warnings.push({
      code: "multiple-steps",
      message: `Several ODB++ steps found (${steps.map((s) => s.step).join(", ")}); using "${picked.step}"`,
    });
  }

  const netNames = parseNetlist(picked.netlist.read().toString("utf8"));
  const netNodes = new Map();

  for (const layer of picked.layers) {
    for (const c of parseComponents(layer.file.read().toString("utf8"), layer.name)) {
      const comp = {
        refdes: c.refdes,
        part: c.props.PART_NAME || undefined,
        value: c.props.VALUE || undefined,
        layer: layer.name === "comp_+_top" ? "top" : "bottom",
        pins: [],
      };
      const seen = new Set();
      for (const p of c.pins) {
        if (seen.has(p.number)) continue;
        seen.add(p.number);
        const name = netNames.get(p.netIndex);
        const provenance = { method: "odb-netlist", file: layer.file.path, sheet: picked.step };
        if (name === undefined) {
          comp.pins.push({ number: p.number, status: STATUS.UNRESOLVED, provenance: { ...provenance, method: "odb-missing-net" } });
        } else if (name === "$NONE$") {
          comp.pins.push({ number: p.number, status: STATUS.NO_CONNECT, provenance: { ...provenance, method: "odb-none-net" } });
        } else {
          comp.pins.push({ number: p.number, net: name, status: STATUS.RESOLVED, provenance });
          if (!netNodes.has(name)) netNodes.set(name, []);
          netNodes.get(name).push({ refdes: c.refdes, pin: p.number });
        }
      }
      design.components.push(comp);
    }
  }

  for (const [name, nodes] of netNodes) design.nets.push({ name, anonymous: isAutoNetName(name), nodes });
  return finalizeDesign(design);
}

module.exports = { id: ID, label: LABEL, supported: true, detect, parse };
