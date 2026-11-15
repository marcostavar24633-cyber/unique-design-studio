import test from "node:test";
import assert from "node:assert/strict";
import { createZip } from "../src/zip-export.js";

test("creates a ZIP archive with local, central and end records", () => {
  const zip = createZip([{name:"index.html",content:"<h1>Hello</h1>"},{name:"README.txt",content:"Open index.html"}]);
  const view = new DataView(zip.buffer,zip.byteOffset,zip.byteLength);
  assert.equal(view.getUint32(0,true),0x04034b50);
  assert.equal(view.getUint32(zip.length-22,true),0x06054b50);
  const centralOffset = view.getUint32(zip.length-22+16,true);
  assert.equal(view.getUint32(centralOffset,true),0x02014b50);
  assert.equal(view.getUint16(zip.length-22+10,true),2);
});

test("rejects unsafe ZIP entry names", () => {
  assert.throws(() => createZip([{name:"../outside.txt",content:"x"}]),/unsafe filename/);
  assert.throws(() => createZip([{name:"",content:"x"}]),/unsafe filename/);
});

test("supports UTF-8 filenames and binary content", () => {
  const zip = createZip([{name:"Инструкция.txt",content:new Uint8Array([1,2,3])}]);
  assert.ok(zip instanceof Uint8Array);
  assert.equal(new DataView(zip.buffer).getUint32(0,true),0x04034b50);
});


test("writes the expected CRC32 checksum for stored file content", () => {
  const zip = createZip([{name:"check.txt",content:"123456789"}]);
  const view = new DataView(zip.buffer,zip.byteOffset,zip.byteLength);
  assert.equal(view.getUint32(14,true),0xcbf43926);
  assert.equal(view.getUint16(12,true),0x21);
});


test("verifies ZIP entries, directory records and CRC32 before download", async () => {
  const { verifyZipArchive } = await import("../src/zip-export.js");
  const zip = createZip([
    {name:"index.html",content:"<!doctype html><title>Site</title>"},
    {name:"README.txt",content:"Open index.html"}
  ]);
  const result = verifyZipArchive(zip,["index.html","README.txt"]);
  assert.equal(result.valid,true);
  assert.deepEqual(result.entries,["index.html","README.txt"]);
});

test("detects corrupted ZIP payload and missing expected files", async () => {
  const { verifyZipArchive } = await import("../src/zip-export.js");
  const zip = createZip([{name:"index.html",content:"original"}]);
  const corrupted = zip.slice();
  corrupted[40] ^= 0xff;
  const result = verifyZipArchive(corrupted,["index.html","README.txt"]);
  assert.equal(result.valid,false);
  assert.ok(result.errors.some(error => error.includes("CRC32 mismatch")));
  assert.ok(result.errors.some(error => error.includes("Missing expected entry")));
});
