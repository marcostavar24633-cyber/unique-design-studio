function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createHistoryManager(limit = 20) {
  const past = [];
  const future = [];
  const max = Number.isInteger(limit) && limit > 0 ? limit : 20;
  return {
    push(snapshot) {
      past.push(clone(snapshot));
      if (past.length > max) past.shift();
      future.length = 0;
    },
    undo(current) {
      if (!past.length) return null;
      future.push(clone(current));
      return past.pop();
    },
    redo(current) {
      if (!future.length) return null;
      past.push(clone(current));
      if (past.length > max) past.shift();
      return future.pop();
    },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    clear() { past.length = 0; future.length = 0; }
  };
}
