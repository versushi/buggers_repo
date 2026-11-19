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

const altium = require("../formats/altium.cjs");
const odb = require("../formats/odb.cjs");
const eagle = require("../formats/eagle.cjs");
const orcad = require("../formats/orcad.cjs");
const pdf = require("../formats/pdf.cjs");

const FORMATS = [altium, odb, eagle, orcad, pdf];
const SUPPORTED_LABELS = FORMATS.filter((f) => f.supported).map((f) => f.label);

function detectAll(files) {
  const hits = [];
  for (const fmt of FORMATS) {
    const hit = fmt.detect(files);
    if (hit) hits.push(hit);
  }
  return hits.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Picks the format to parse. Several supported formats with real confidence is
 * ambiguous and is reported rather than guessed; `forceFormat` resolves it.
 */
function choose(files, forceFormat) {
  const hits = detectAll(files);
  if (forceFormat) {
    const hit = hits.find((h) => h.format === forceFormat);
    if (!hit) throw new Error(`Format "${forceFormat}" not found in the input. Detected: ${describe(hits)}`);
    return { hit, hits };
  }
  const usable = hits.filter((h) => h.supported && h.confidence >= 0.5);
  if (usable.length === 1) return { hit: usable[0], hits };
  if (usable.length > 1) {
    throw new Error(
      `Input contains more than one supported format (${usable.map((h) => h.format).join(", ")}). ` +
        "Pass --format <name> to choose one.",
    );
  }
  const unsupported = hits.find((h) => !h.supported);
  if (unsupported) throw new Error(`${unsupported.label}: ${unsupported.hint}`);
  if (hits.length > 0) throw new Error(`Found ${hits[0].label} but it cannot be read: ${hits[0].reason}`);
  throw new Error(`No supported design format found. Supported: ${SUPPORTED_LABELS.join("; ")}.`);
}

function describe(hits) {
  return hits.length ? hits.map((h) => `${h.format} (${h.reason})`).join("; ") : "nothing recognised";
}

function load(files, forceFormat) {
  const { hit } = choose(files, forceFormat);
  const fmt = FORMATS.find((f) => f.id === hit.format);
  return fmt.parse(files);
}

module.exports = { FORMATS, SUPPORTED_LABELS, detectAll, choose, load };
