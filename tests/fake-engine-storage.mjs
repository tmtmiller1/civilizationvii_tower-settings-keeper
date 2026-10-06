// fake-engine-storage.mjs - a Storage with Civilization VII 1.5.0's behaviour, for the tests.
// getItem ignores its key and returns the first row in key order; key(i) is null; the empty key and keys starting
// with NUL are dropped; setItem, removeItem, clear and length are correct. Methods and length live on the
// prototype, as Storage.prototype does in the game.
export class FakeEngineStorage {
  constructor(rows = {}) {
    this._rows = new Map();
    for (const k of Object.keys(rows)) this._rows.set(k, String(rows[k]));
    this.writes = 0;
  }
  _first() {
    const keys = Array.from(this._rows.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return keys.length ? this._rows.get(keys[0]) : null;
  }
  getItem(_k) {
    return this._first();
  }
  setItem(k, v) {
    const key = String(k);
    if (key === "" || key.charCodeAt(0) === 0) return;
    this._rows.set(key, String(v));
    this.writes += 1;
  }
  removeItem(k) {
    this._rows.delete(String(k));
  }
  clear() {
    this._rows.clear();
  }
  key(_i) {
    return null;
  }
  get length() {
    return this._rows.size;
  }
  /** Test-only: the rows as the SQLite file would hold them. */
  rows() {
    return Object.fromEntries(Array.from(this._rows.entries()).sort());
  }
}

/** A fresh prototype per store so a keeper patch on one instance cannot leak into another test. */
export function fakeStore(rows) {
  const s = new FakeEngineStorage(rows);
  return s;
}
