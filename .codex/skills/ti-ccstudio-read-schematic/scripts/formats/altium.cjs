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
const { openCfb, isOle2 } = require("../lib/ole2.cjs");
const { STATUS, STATUS_RANK, newDesign, finalizeDesign, anonNetName } = require("../lib/model.cjs");

const ID = "altium";
const LABEL = "Altium Designer schematic (.SchDoc)";

const SNAP_TOLERANCE = 15;
const ZERO_OHM_JUMPER_RE = /\b0\s*(ohm|Ω)\b|\bjumper\b|\b0R0*\b/i;
const PARAMS_OF_INTEREST = new Set(["Value", "Comment", "PartNumber", "Manufacturer Part Number"]);

function isSchDocName(p) {
  return p.toLowerCase().endsWith(".schdoc");
}

function openSheet(file) {
  const buf = file.read();
  if (!isOle2(buf)) throw new Error("not an OLE2 file (ASCII-format .SchDoc is not supported; save as binary)");
  const cfb = openCfb(buf);
  if (!cfb.streams.includes("FileHeader")) throw new Error("no FileHeader stream; not an Altium schematic");
  return cfb.read("FileHeader");
}

function detect(files) {
  const candidates = files.filter((f) => isSchDocName(f.path));
  if (candidates.length === 0) return null;
  const valid = [];
  const bad = [];
  for (const f of candidates) {
    try {
      const buf = f.read();
      if (isOle2(buf) && openCfb(buf).streams.includes("FileHeader")) valid.push(f.path);
      else bad.push(f.path);
    } catch (_) {
      bad.push(f.path);
    }
  }
  if (valid.length === 0) {
    const reason = "files named .SchDoc but none is a binary Altium schematic";
    return { format: ID, label: LABEL, supported: true, confidence: 0.2, files: bad, reason };
  }
  return { format: ID, label: LABEL, supported: true, confidence: 0.95, files: valid, reason: `${valid.length} Altium schematic sheet(s)` };
}

/** `|RECORD=n|KEY=val|...` text separated by NULs. Keys are upper-cased: casing differs between Altium versions. */
function parseAltiumRecords(streamBuf) {
  const text = streamBuf.toString("latin1");
  const records = [];
  const re = /\|RECORD=(\d+)\|([^\0]*)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = {};
    for (const kv of m[2].split("|")) {
      const eq = kv.indexOf("=");
      if (eq > 0) fields[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1);
    }
    records.push({ type: parseInt(m[1], 10), fields, index: records.length });
  }
  return records;
}

const num = (v) => (v === undefined || v === "" ? 0 : parseInt(v, 10));
const pt = (x, y) => `${x},${y}`;

function pinElectricalPoint(p) {
  const x = num(p.fields["LOCATION.X"]);
  const y = num(p.fields["LOCATION.Y"]);
  const rot = num(p.fields.PINCONGLOMERATE) % 4;
  const len = num(p.fields.PINLENGTH);
  if (rot === 0) return pt(x + len, y);
  if (rot === 1) return pt(x, y + len);
  if (rot === 2) return pt(x - len, y);
  return pt(x, y - len);
}

class UnionFind {
  constructor() {
    this.parent = new Map();
  }
  find(x) {
    let root = x;
    while (this.parent.has(root) && this.parent.get(root) !== root) root = this.parent.get(root);
    if (!this.parent.has(root)) this.parent.set(root, root);
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur) || cur;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Resolves every placed component on one sheet. A component's pins are those of its
 * current part AND its current display mode: symbols that carry an alternate drawing
 * store a second set of pins at coordinates with no wires.
 */
function parseSheet(records, sheetName) {
  const comps = new Map();
  const desigByOwner = new Map();
  const params = new Map();
  for (const r of records) {
    if (r.type === 1) comps.set(String(r.index), r.fields);
    else if (r.type === 34 && r.fields.NAME === "Designator") desigByOwner.set(r.fields.OWNERINDEX, r.fields.TEXT);
    else if (r.type === 41 && PARAMS_OF_INTEREST.has(r.fields.NAME)) {
      if (!params.has(r.fields.OWNERINDEX)) params.set(r.fields.OWNERINDEX, {});
      params.get(r.fields.OWNERINDEX)[r.fields.NAME] = r.fields.TEXT;
    }
  }

  const activePins = [];
  const pinsByOwner = new Map();
  for (const p of records) {
    if (p.type !== 2) continue;
    const owner = p.fields.OWNERINDEX;
    const comp = comps.get(owner);
    const refdes = desigByOwner.get(owner);
    if (!comp || !refdes) continue;
    if ((p.fields.OWNERPARTID || "1") !== (comp.CURRENTPARTID || "1")) continue;
    if ((p.fields.OWNERPARTDISPLAYMODE || "0") !== (comp.DISPLAYMODE || "0")) continue;
    const entry = { rec: p, owner, refdes, number: p.fields.DESIGNATOR, label: p.fields.NAME, elec: pinElectricalPoint(p) };
    activePins.push(entry);
    if (!pinsByOwner.has(owner)) pinsByOwner.set(owner, []);
    pinsByOwner.get(owner).push(entry);
  }

  const wires = [];
  const knownNodes = [];
  for (const r of records) {
    if (r.type !== 27) continue;
    const n = num(r.fields.LOCATIONCOUNT);
    const coords = [];
    for (let i = 1; i <= n; i++) {
      const x = r.fields[`X${i}`];
      const y = r.fields[`Y${i}`];
      if (x === undefined && y === undefined) continue;
      coords.push(pt(num(x), num(y)));
      knownNodes.push([num(x), num(y)]);
    }
    wires.push(coords);
  }
  for (const p of records) {
    if (p.type !== 2) continue;
    knownNodes.push(pinElectricalPoint(p).split(",").map(Number));
  }

  // A label's stored location is its text anchor, not always the electrical point.
  const snap = (x, y) => {
    let best = null;
    let bestDist = Infinity;
    for (const [nx, ny] of knownNodes) {
      const d = Math.hypot(nx - x, ny - y);
      if (d <= SNAP_TOLERANCE && d < bestDist) {
        best = pt(nx, ny);
        bestDist = d;
      }
    }
    return best;
  };
  const labels = [];
  for (const r of records) {
    if ((r.type !== 17 && r.type !== 25) || !r.fields.TEXT) continue;
    const x = num(r.fields["LOCATION.X"]);
    const y = num(r.fields["LOCATION.Y"]);
    labels.push({ text: r.fields.TEXT, point: snap(x, y) || pt(x, y) });
  }

  const noerc = [];
  for (const r of records) {
    if (r.type === 22 && r.fields.SYMBOL === "Thin Cross") noerc.push([num(r.fields["LOCATION.X"]), num(r.fields["LOCATION.Y"])]);
  }
  const nearNoerc = (elec) => {
    const [ex, ey] = elec.split(",").map(Number);
    return noerc.some(([nx, ny]) => Math.hypot(nx - ex, ny - ey) <= SNAP_TOLERANCE);
  };

  // Only deliberate 0 ohm jumpers connect their two pins; any other two-pin part (decoupling cap,
  // series resistor) would merge unrelated nets such as VCC and GND.
  const jumpers = [];
  for (const [owner, plist] of pinsByOwner) {
    if (plist.length !== 2) continue;
    const names = plist.map((p) => p.number).sort();
    if (names[0] !== "1" || names[1] !== "2") continue;
    const comp = comps.get(owner);
    if (!ZERO_OHM_JUMPER_RE.test(`${comp.COMPONENTDESCRIPTION || ""} ${comp.LIBREFERENCE || ""}`)) continue;
    jumpers.push({ refdes: plist[0].refdes, a: plist[0].elec, b: plist[1].elec });
  }

  function buildGraph(withJumpers) {
    const uf = new UnionFind();
    for (const coords of wires) for (let i = 0; i < coords.length - 1; i++) uf.union(coords[i], coords[i + 1]);
    if (withJumpers) for (const j of jumpers) uf.union(j.a, j.b);

    const namesByRoot = new Map();
    for (const l of labels) {
      const root = uf.find(l.point);
      if (!namesByRoot.has(root)) namesByRoot.set(root, new Set());
      namesByRoot.get(root).add(l.text);
    }
    const pinsByRoot = new Map();
    for (const p of activePins) {
      const root = uf.find(p.elec);
      if (!pinsByRoot.has(root)) pinsByRoot.set(root, []);
      pinsByRoot.get(root).push(p);
    }
    const jumpersByRoot = new Map();
    if (withJumpers) {
      for (const j of jumpers) {
        const root = uf.find(j.a);
        if (!jumpersByRoot.has(root)) jumpersByRoot.set(root, []);
        jumpersByRoot.get(root).push(j.refdes);
      }
    }
    return { uf, namesByRoot, pinsByRoot, jumpersByRoot };
  }
  const plain = buildGraph(false);
  const bridged = buildGraph(true);

  const peersOf = (graph, p) =>
    (graph.pinsByRoot.get(graph.uf.find(p.elec)) || [])
      .filter((o) => o.refdes !== p.refdes)
      .map((o) => ({ refdes: o.refdes, pin: o.number }));

  const prov = (method, extra) => ({ method, file: sheetName, sheet: sheetName, ...extra });

  const byRefdes = new Map();
  const netNodes = new Map();

  for (const p of activePins) {
    let comp = byRefdes.get(p.refdes);
    if (!comp) {
      const c = comps.get(p.owner);
      const prm = params.get(p.owner) || {};
      comp = {
        refdes: p.refdes,
        part: c.LIBREFERENCE || undefined,
        value: prm.Value || prm.Comment || undefined,
        mpn: prm.PartNumber || prm["Manufacturer Part Number"] || undefined,
        description: c.COMPONENTDESCRIPTION || undefined,
        sheet: sheetName,
        pins: [],
        seen: new Set(),
      };
      byRefdes.set(p.refdes, comp);
    }
    if (comp.seen.has(p.number)) continue;
    comp.seen.add(p.number);

    const pin = { number: p.number };
    if (p.label && p.label !== p.number) pin.name = p.label;

    const rootPlain = plain.uf.find(p.elec);
    const rootBridged = bridged.uf.find(p.elec);
    const namesPlain = plain.namesByRoot.get(rootPlain);
    const namesBridged = bridged.namesByRoot.get(rootBridged);
    const viaJumpers = bridged.jumpersByRoot.get(rootBridged);
    const peersBridged = peersOf(bridged, p);

    let key = null;
    if (namesBridged && namesBridged.size > 0) {
      const names = [...namesBridged];
      const usedBridge = !(namesPlain && namesPlain.size > 0) && viaJumpers;
      if (names.length > 1) {
        pin.status = STATUS.AMBIGUOUS;
        pin.candidates = names;
        pin.provenance = prov("net-label", usedBridge ? { bridges: viaJumpers } : {});
      } else {
        pin.net = names[0];
        pin.status = usedBridge ? STATUS.BRIDGED : STATUS.RESOLVED;
        pin.provenance = prov(usedBridge ? "jumper-bridge" : "net-label", usedBridge ? { bridges: viaJumpers } : {});
      }
      key = { names };
    } else if (peersBridged.length > 0) {
      pin.status = STATUS.RESOLVED;
      pin.peers = peersBridged;
      pin.provenance = prov("direct-wire");
      key = { anon: true };
    } else if (nearNoerc(p.elec)) {
      pin.status = STATUS.NO_CONNECT;
      pin.provenance = prov("noerc-marker");
    } else {
      pin.status = STATUS.UNRESOLVED;
      pin.provenance = prov("none");
    }
    comp.pins.push(pin);

    if (key) {
      if (!netNodes.has(rootBridged)) netNodes.set(rootBridged, { names: key.names, nodes: [] });
      const entry = netNodes.get(rootBridged);
      if (key.names && !entry.names) entry.names = key.names;
      entry.nodes.push({ refdes: p.refdes, pin: p.number });
    }
  }

  // Unlabelled nets still list every pin that touches them.
  for (const [root, group] of bridged.pinsByRoot) {
    if (group.length < 2) continue;
    if (!netNodes.has(root)) {
      if (group.length < 2 || new Set(group.map((g) => g.refdes)).size < 2) continue;
      netNodes.set(root, { names: null, nodes: [] });
    }
    const entry = netNodes.get(root);
    for (const g of group) entry.nodes.push({ refdes: g.refdes, pin: g.number });
  }

  const nets = [];
  for (const { names, nodes } of netNodes.values()) {
    if (names && names.length > 0) {
      const sorted = [...names].sort();
      nets.push({ name: sorted[0], aliases: sorted.length > 1 ? sorted.slice(1) : undefined, anonymous: false, nodes });
    } else {
      nets.push({ name: anonNetName(nodes), anonymous: true, nodes });
    }
  }

  const components = [...byRefdes.values()].map(({ seen, ...c }) => c);
  return { components, nets, instances: new Set(desigByOwner.values()).size };
}

function parse(files) {
  const sheets = files.filter((f) => isSchDocName(f.path));
  const design = newDesign(ID, sheets.map((f) => f.path));
  const merged = new Map();

  for (const f of sheets) {
    let records;
    try {
      records = parseAltiumRecords(openSheet(f));
    } catch (e) {
      design.warnings.push({ code: "sheet-unreadable", message: `${f.path}: ${e.message}` });
      continue;
    }
    const sheetName = path.posix.basename(f.path);
    design.source.sheets.push(sheetName);
    const sheet = parseSheet(records, sheetName);
    design.nets.push(...sheet.nets);

    for (const c of sheet.components) {
      const have = merged.get(c.refdes);
      if (!have) {
        merged.set(c.refdes, c);
        continue;
      }
      design.warnings.push({
        code: "multi-sheet-refdes",
        message: `${c.refdes} appears on ${have.sheet} and ${c.sheet}; pins merged, best-resolved result kept per pin`,
        refdes: c.refdes,
      });
      const byNumber = new Map(have.pins.map((p) => [p.number, p]));
      for (const pin of c.pins) {
        const prev = byNumber.get(pin.number);
        if (!prev || STATUS_RANK[pin.status] > STATUS_RANK[prev.status]) byNumber.set(pin.number, pin);
      }
      have.pins = [...byNumber.values()];
      have.part = have.part || c.part;
      have.value = have.value || c.value;
    }
  }

  design.components = [...merged.values()];
  if (design.components.length === 0 && design.warnings.length > 0) {
    throw new Error(`No Altium sheet could be read:\n  ${design.warnings.map((w) => w.message).join("\n  ")}`);
  }
  return finalizeDesign(design);
}

module.exports = { id: ID, label: LABEL, supported: true, detect, parse, parseAltiumRecords };
