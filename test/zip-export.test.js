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
