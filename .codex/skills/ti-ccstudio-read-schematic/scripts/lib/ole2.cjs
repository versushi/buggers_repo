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

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const MAX_CHAIN = 4_000_000;

function isOle2(buf) {
  return buf.length >= 8 && buf.readUInt32BE(0) === 0xd0cf11e0 && buf.readUInt32BE(4) === 0xa1b11ae1;
}

/**
 * Minimal MS-CFB reader. Returns { streams: [names], read(name) }.
 * Supports FAT, MiniFAT and DIFAT chains.
 */
function openCfb(buf) {
  if (!isOle2(buf)) throw new Error("Not an OLE2/CFB file (bad signature)");

  const sectorSize = 2 ** buf.readUInt16LE(30);
  const miniSectorSize = 2 ** buf.readUInt16LE(32);
  const numFatSectors = buf.readUInt32LE(44);
  const firstDirSector = buf.readUInt32LE(48);
  const miniStreamCutoff = buf.readUInt32LE(56);
  const firstMiniFatSector = buf.readUInt32LE(60);
  const firstDifatSector = buf.readUInt32LE(68);
  const numDifatSectors = buf.readUInt32LE(72);

  const sectorOffset = (s) => 512 + s * sectorSize;
  const inFile = (off) => off >= 0 && off + sectorSize <= buf.length;

  const fatSectors = [];
  for (let i = 0; i < Math.min(numFatSectors, 109); i++) fatSectors.push(buf.readUInt32LE(76 + i * 4));
  let difat = firstDifatSector;
  for (let n = 0; n < numDifatSectors && difat !== ENDOFCHAIN && difat !== FREESECT; n++) {
    const off = sectorOffset(difat);
    if (!inFile(off)) throw new Error("Corrupt CFB file (DIFAT sector out of range)");
    const per = sectorSize / 4 - 1;
    for (let i = 0; i < per && fatSectors.length < numFatSectors; i++) fatSectors.push(buf.readUInt32LE(off + i * 4));
    difat = buf.readUInt32LE(off + per * 4);
  }

  const perSector = sectorSize / 4;
  const fat = new Uint32Array(fatSectors.length * perSector);
  fatSectors.forEach((sec, idx) => {
    const off = sectorOffset(sec);
    if (!inFile(off)) throw new Error("Corrupt CFB file (FAT sector out of range)");
    for (let e = 0; e < perSector; e++) fat[idx * perSector + e] = buf.readUInt32LE(off + e * 4);
  });

  function readChain(start, size) {
    const chunks = [];
    let sec = start;
    let remaining = size;
    let guard = 0;
    while (sec !== ENDOFCHAIN && sec !== FREESECT && remaining > 0) {
      const off = sectorOffset(sec);
      if (!inFile(off) && off >= buf.length) throw new Error("Corrupt CFB file (sector out of range)");
      const take = Math.min(sectorSize, remaining);
      chunks.push(buf.subarray(off, off + take));
      remaining -= take;
      sec = fat[sec];
      if (++guard > MAX_CHAIN) throw new Error("Corrupt CFB file (FAT chain too long)");
    }
    return Buffer.concat(chunks);
  }

  function chainBytes(start) {
    let sec = start;
    let count = 0;
    while (sec !== ENDOFCHAIN && sec !== FREESECT) {
      count++;
      sec = fat[sec];
      if (count > MAX_CHAIN) throw new Error("Corrupt CFB file (chain too long)");
    }
    return count * sectorSize;
  }

  const dirBuf = readChain(firstDirSector, chainBytes(firstDirSector));
  const entries = [];
  for (let off = 0; off + 128 <= dirBuf.length; off += 128) {
    const nameLen = dirBuf.readUInt16LE(off + 64);
    if (nameLen === 0) continue;
    entries.push({
      name: dirBuf.toString("utf16le", off, off + Math.max(0, nameLen - 2)),
      objectType: dirBuf.readUInt8(off + 66),
      startSector: dirBuf.readUInt32LE(off + 116),
      size: dirBuf.readUInt32LE(off + 120),
    });
  }
  const root = entries.find((e) => e.objectType === 5);
  if (!root) throw new Error("Corrupt CFB file (no root storage)");

  let mini = null;
  function miniState() {
    if (mini) return mini;
    const fatBuf = readChain(firstMiniFatSector, chainBytes(firstMiniFatSector));
    const miniFat = new Uint32Array(fatBuf.length / 4);
    for (let i = 0; i < miniFat.length; i++) miniFat[i] = fatBuf.readUInt32LE(i * 4);
    mini = { miniFat, container: readChain(root.startSector, root.size) };
    return mini;
  }

  const streams = entries.filter((e) => e.objectType === 2);

  return {
    streams: streams.map((e) => e.name),
    read(name) {
      const target = streams.find((e) => e.name === name);
      if (!target) throw new Error(`Stream "${name}" not found. Available streams: ${streams.map((e) => e.name).join(", ")}`);
      if (target.size >= miniStreamCutoff) return readChain(target.startSector, target.size).subarray(0, target.size);
      const { miniFat, container } = miniState();
      const chunks = [];
      let sec = target.startSector;
      let remaining = target.size;
      let guard = 0;
      while (sec !== ENDOFCHAIN && sec !== FREESECT && remaining > 0) {
        const off = sec * miniSectorSize;
        const take = Math.min(miniSectorSize, remaining);
        chunks.push(container.subarray(off, off + take));
        remaining -= take;
        sec = miniFat[sec];
        if (++guard > MAX_CHAIN) throw new Error("Corrupt CFB file (mini stream chain too long)");
      }
      return Buffer.concat(chunks).subarray(0, target.size);
    },
  };
}

module.exports = { openCfb, isOle2 };
