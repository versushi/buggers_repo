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

const SCHEMA_VERSION = 1;

const STATUS = Object.freeze({
  RESOLVED: "resolved",
  BRIDGED: "bridged-via-passive",
  NO_CONNECT: "no-connect-confirmed",
  AMBIGUOUS: "ambiguous-needs-review",
  UNRESOLVED: "unresolved-needs-review",
});

// Higher wins when the same pin is seen on several sheets.
const STATUS_RANK = Object.freeze({
  [STATUS.RESOLVED]: 5,
  [STATUS.BRIDGED]: 4,
  [STATUS.AMBIGUOUS]: 3,
  [STATUS.NO_CONNECT]: 2,
  [STATUS.UNRESOLVED]: 1,
});

const AUTO_NET_RE = /^(N\d+|N\$\d+|\$\d+N\d+|UNNAMED_.*|NET\d+|unconnected-.*|Net-\(.*\))$/i;

function isAutoNetName(name) {
  return AUTO_NET_RE.test(name);
}

function newDesign(format, files) {
  return {
    schemaVersion: SCHEMA_VERSION,
    source: { format, files, sheets: [] },
    components: [],
    nets: [],
    warnings: [],
  };
}

function naturalCompare(a, b) {
  const re = /(\d+)|(\D+)/g;
  const pa = String(a).match(re) || [];
  const pb = String(b).match(re) || [];
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return parseInt(x, 10) - parseInt(y, 10);
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}

/**
 * Merges nets with the same name (a name is global across sheets), removes
 * duplicate nodes, and sorts everything so output is stable between runs.
 */
function finalizeDesign(design) {
  const byName = new Map();
  for (const net of design.nets) {
    const prev = byName.get(net.name);
    if (!prev) {
      byName.set(net.name, { ...net, nodes: [...net.nodes] });
      continue;
    }
    prev.nodes.push(...net.nodes);
    prev.anonymous = prev.anonymous && net.anonymous;
    if (net.aliases) prev.aliases = [...new Set([...(prev.aliases || []), ...net.aliases])];
  }
  design.nets = [...byName.values()].map((net) => {
    const seen = new Set();
    net.nodes = net.nodes
      .filter((n) => {
        const key = `${n.refdes} ${n.pin}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => naturalCompare(a.refdes, b.refdes) || naturalCompare(a.pin, b.pin));
    return net;
  });
  design.nets.sort((a, b) => naturalCompare(a.name, b.name));

  design.components.sort((a, b) => naturalCompare(a.refdes, b.refdes));
  for (const c of design.components) c.pins.sort((a, b) => naturalCompare(a.number, b.number));
  design.source.sheets = [...new Set(design.source.sheets)];
  return design;
}

function anonNetName(nodes) {
  const first = nodes.map((n) => `${n.refdes}.${n.pin}`).sort(naturalCompare)[0];
  return `anon:${first}`;
}

module.exports = { SCHEMA_VERSION, STATUS, STATUS_RANK, isAutoNetName, newDesign, finalizeDesign, naturalCompare, anonNetName };
