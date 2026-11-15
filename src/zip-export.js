const encoder = new TextEncoder();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bytesOf(value) {
  return value instanceof Uint8Array ? value : encoder.encode(String(value ?? ""));
}

function write16(view, offset, value) { view.setUint16(offset,value,true); }
function write32(view, offset, value) { view.setUint32(offset,value >>> 0,true); }

/** Build a standards-compliant ZIP archive using the uncompressed STORE method. */
export function createZip(entries) {
  if (!Array.isArray(entries) || !entries.length) throw new TypeError("At least one ZIP entry is required");
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = String(entry?.name || "");
    if (!name || name.startsWith("/") || name.includes("..") || /[\\\\:*?"<>|]/.test(name)) {
      throw new TypeError("ZIP entry has an unsafe filename");
    }
    const nameBytes = encoder.encode(name);
    const data = bytesOf(entry.content);
    if (nameBytes.length > 65535 || data.length > 0xffffffff) throw new RangeError("ZIP entry is too large");
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    write32(lv,0,0x04034b50); write16(lv,4,20); write16(lv,6,0x0800);
    write16(lv,8,0); write16(lv,10,0); write16(lv,12,0x21);
    write32(lv,14,crc); write32(lv,18,data.length); write32(lv,22,data.length);
    write16(lv,26,nameBytes.length); write16(lv,28,0); local.set(nameBytes,30);
    localParts.push(local,data);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    write32(cv,0,0x02014b50); write16(cv,4,20); write16(cv,6,20);
    write16(cv,8,0x0800); write16(cv,10,0); write16(cv,12,0); write16(cv,14,0x21);
    write32(cv,16,crc); write32(cv,20,data.length); write32(cv,24,data.length);
    write16(cv,28,nameBytes.length); write16(cv,30,0); write16(cv,32,0);
    write16(cv,34,0); write16(cv,36,0); write32(cv,38,0); write32(cv,42,localOffset);
    central.set(nameBytes,46); centralParts.push(central);
    localOffset += local.length + data.length;
  }
  const centralSize = centralParts.reduce((sum,part) => sum + part.length,0);
  const count = entries.length;
  if (count > 65535 || localOffset > 0xffffffff || centralSize > 0xffffffff) throw new RangeError("ZIP archive exceeds ZIP32 limits");
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  write32(ev,0,0x06054b50); write16(ev,4,0); write16(ev,6,0);
  write16(ev,8,count); write16(ev,10,count); write32(ev,12,centralSize);
  write32(ev,16,localOffset); write16(ev,20,0);
  const total = localOffset + centralSize + end.length;
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of [...localParts,...centralParts,end]) { output.set(part,offset); offset += part.length; }
  return output;
}


/** Verify the STORE-only ZIP structure and CRC32 checksums before download. */
export function verifyZipArchive(input, expectedNames = [], expectedContent = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  const errors = [];
  const names = [];
  if (bytes.length < 22) return {valid:false,entries:names,errors:["Archive is too small"]};
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset = 0;
  const localOffsets = [];
  while (offset + 4 <= bytes.length && view.getUint32(offset,true) === 0x04034b50) {
    if (offset + 30 > bytes.length) {
      errors.push("Truncated local file header");
      break;
    }
    const flags = view.getUint16(offset + 6,true);
    const method = view.getUint16(offset + 8,true);
    const crc = view.getUint32(offset + 14,true);
    const compressedSize = view.getUint32(offset + 18,true);
    const size = view.getUint32(offset + 22,true);
    const nameLength = view.getUint16(offset + 26,true);
    const extraLength = view.getUint16(offset + 28,true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if ((flags & 0x0008) || method !== 0 || compressedSize !== size || dataEnd > bytes.length) {
      errors.push("Unsupported or truncated local entry");
      break;
    }
    const name = new TextDecoder().decode(bytes.subarray(nameStart,nameStart + nameLength));
    const data = bytes.subarray(dataStart,dataEnd);
    if (crc32(data) !== crc) errors.push("CRC32 mismatch: " + name);
    if (Object.hasOwn(expectedContent,name)) {
      const expected = bytesOf(expectedContent[name]);
      if (expected.length !== data.length || expected.some((byte,index) => byte !== data[index])) {
        errors.push("Content mismatch: " + name);
      }
    }
    names.push(name);
    localOffsets.push(offset);
    offset = dataEnd;
  }
  const centralStart = offset;
  let centralCount = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset,true) === 0x02014b50) {
    if (offset + 46 > bytes.length) {
      errors.push("Truncated central directory header");
      break;
    }
    const nameLength = view.getUint16(offset + 28,true);
    const extraLength = view.getUint16(offset + 30,true);
    const commentLength = view.getUint16(offset + 32,true);
    const localOffset = view.getUint32(offset + 42,true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46,offset + 46 + nameLength));
    if (localOffsets[centralCount] !== localOffset || names[centralCount] !== name) {
      errors.push("Central directory does not match local entry: " + name);
    }
    centralCount++;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset + 22 !== bytes.length || view.getUint32(offset,true) !== 0x06054b50) {
    errors.push("Missing or malformed end-of-central-directory record");
  } else {
    const diskEntries = view.getUint16(offset + 8,true);
    const totalEntries = view.getUint16(offset + 10,true);
    const centralSize = view.getUint32(offset + 12,true);
    const centralOffset = view.getUint32(offset + 16,true);
    if (diskEntries !== names.length || totalEntries !== names.length || centralCount !== names.length) {
      errors.push("ZIP entry counts do not match");
    }
    if (centralOffset !== centralStart || centralSize !== offset - centralStart) {
      errors.push("ZIP central directory size or offset is invalid");
    }
  }
  for (const expected of expectedNames) {
    if (!names.includes(expected)) errors.push("Missing expected entry: " + expected);
  }
  return {valid:errors.length === 0,entries:names,errors};
}
