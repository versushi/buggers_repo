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

const { STATUS } = require("./model.cjs");
const { summarize } = require("./query.cjs");

const cell = (s) => String(s === undefined || s === null ? "" : s).replace(/\|/g, "\\|");

function netCell(pin) {
  switch (pin.status) {
    case STATUS.RESOLVED:
    case STATUS.BRIDGED:
      if (pin.net) return pin.net;
      return `→ ${(pin.peers || []).map((p) => `${p.refdes}.${p.pin}`).join(", ")}`;
    case STATUS.NO_CONNECT:
      return "NC";
    case STATUS.AMBIGUOUS:
      return `⚠ AMBIGUOUS: ${(pin.candidates || []).join(" | ")}`;
    default:
      return "⚠ UNRESOLVED";
  }
}

function notesCell(pin) {
  const notes = [];
  if (pin.name) notes.push(`label ${pin.name}`);
  if (pin.status === STATUS.BRIDGED) notes.push(`via ${pin.provenance.bridges.join(", ")}`);
  if (pin.status === STATUS.NO_CONNECT) notes.push(`confirmed by ${pin.provenance.method}`);
  return notes.join("; ");
}

function renderDetect(inputLabel, hits, fileCount) {
  const lines = [`# Detect: ${inputLabel}`, "", `${fileCount} file(s) scanned.`, ""];
  if (hits.length === 0) {
    lines.push("No known design format found.");
    return lines.join("\n");
  }
  lines.push("| Format | Readable | Confidence | Evidence |", "|---|---|---|---|");
  for (const h of hits) lines.push(`| ${cell(h.format)} | ${h.supported ? "yes" : "no"} | ${h.confidence} | ${cell(h.reason)} |`);
  for (const h of hits.filter((x) => x.hint)) lines.push("", `**${h.label}:** ${h.hint}`);
  return lines.join("\n");
}

function renderComponents(design, rows) {
  const lines = [`# Components (${rows.length}) — ${design.source.format}`, ""];
  if (rows.length === 0) {
    lines.push("None match. Loosen --filter or lower --min-pins.");
    return lines.join("\n");
  }
  lines.push("| Refdes | Pins | Part | Value | Sheet |", "|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(`| ${cell(r.refdes)} | ${r.pinCount} | ${cell(r.part)} | ${cell(r.value)} | ${cell(r.sheet || r.layer)} |`);
  }
  return lines.join("\n");
}

function renderComponent(comp) {
  const counts = summarize(comp);
  const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ");
  const lines = [`## ${comp.refdes}${comp.part ? ` — ${comp.part}` : ""}`, `${comp.pins.length} pins: ${summary}`, ""];
  lines.push("| Pin | Net | Notes |", "|---|---|---|");
  for (const p of comp.pins) lines.push(`| ${cell(p.number)} | ${cell(netCell(p))} | ${cell(notesCell(p))} |`);
  const review = comp.pins.filter((p) => p.status === STATUS.UNRESOLVED || p.status === STATUS.AMBIGUOUS);
  if (review.length) {
    lines.push("", `Needs manual review (no net proven, not marked no-connect): ${review.map((p) => p.number).join(", ")}`);
  }
  return lines.join("\n");
}

function renderWarnings(design) {
  if (!design.warnings.length) return "";
  return ["", "Warnings:", ...design.warnings.map((w) => `- ${w.code}: ${w.message}`)].join("\n");
}

module.exports = { renderDetect, renderComponents, renderComponent, renderWarnings, netCell };
