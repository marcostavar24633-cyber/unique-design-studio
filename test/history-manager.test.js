import test from "node:test";
import assert from "node:assert/strict";
import { createHistoryManager } from "../src/history-manager.js";

test("undo and redo restore independent snapshots", () => {
  const history = createHistoryManager();
  const first = { title:"First", nested:{ value:1 } };
  const second = { title:"Second", nested:{ value:2 } };
  history.push(first);
  const undone = history.undo(second);
  assert.deepEqual(undone,first);
  assert.equal(history.canRedo,true);
  const redone = history.redo(undone);
  assert.deepEqual(redone,second);
  assert.equal(history.canUndo,true);
});

test("new edits clear redo and history is bounded", () => {
  const history = createHistoryManager(2);
  history.push({ value:1 });
  history.push({ value:2 });
  history.push({ value:3 });
  assert.deepEqual(history.undo({ value:4 }),{ value:3 });
  history.push({ value:5 });
  assert.equal(history.canRedo,false);
  assert.deepEqual(history.undo({ value:6 }),{ value:5 });
});

test("snapshots are cloned and empty undo redo return null", () => {
  const history = createHistoryManager();
  const state = { items:[1] };
  history.push(state);
  state.items.push(2);
  assert.deepEqual(history.undo({ items:[3] }),{ items:[1] });
  assert.equal(history.undo({}),null);
  assert.equal(history.redo({}),null);
});
