// sk-core.test.mjs - the keeper on a store that behaves like the game's.
import test from "node:test";
import assert from "node:assert/strict";
import { install, ROOT_KEY, FALLBACK_ROOT_KEY, VIRTUAL_KEY, MARK_KEY, BLOCKED_KEY, looksLikeRoot, KNOWN_KEYS } from "../ui/settings-keeper.js";
import { fakeStore } from "./fake-engine-storage.mjs";

const logs = [];
const log = (level, msg) => logs.push(level + ": " + msg);
const opts = () => ({ log, knownKeys: KNOWN_KEYS, now: () => 1700000000000 });
const HOF = JSON.stringify({ "demographics-halloffame": { games: { a: 1 } }, demographics: { x: 1 }, emigration: { y: 2 } });
const AM = JSON.stringify({ autoSpread: true, targetCityStates: true, targetTriumphs: true, garrisonLastCharge: false, ignoreAsleep: true, showDockButton: false });
const ARCHIVE = JSON.stringify({ v: 1, updated: 5, games: { g1: {} } });

/** The game helper most mods ship: wipe on a second row, then read-modify-write a slice. */
function helperSave(ls, modID, optionID, value) {
  if (ls.length > 1) ls.clear();
  const options = JSON.parse(ls.getItem("modSettings") || "{}");
  options[modID] ??= {};
  options[modID][optionID] = value;
  ls.setItem("modSettings", JSON.stringify(options));
}
function helperLoad(ls, modID, optionID) {
  const storage = ls.getItem("modSettings");
  if (!storage) return null;
  return (JSON.parse(storage)[modID] ?? {})[optionID];
}

test("the fake store has the bug", () => {
  const ls = fakeStore({ modSettings: HOF });
  ls.setItem("zzz", "Z");
  assert.equal(ls.getItem("zzz"), HOF);
  assert.equal(ls.key(0), null);
  assert.equal(ls.length, 2);
  ls.setItem("", "nothing");
  assert.equal(ls.length, 2);
});

test("round trip on any key, modSettings passed through, length 1, key(0)", () => {
  const ls = fakeStore({ modSettings: HOF });
  const api = install(ls, opts());
  ls.setItem("AutoMissionary.settings.v2", AM);
  ls.setItem("zzz-late", "LATE");
  assert.equal(ls.getItem("AutoMissionary.settings.v2"), AM);
  assert.equal(ls.getItem("zzz-late"), "LATE");
  assert.equal(ls.getItem("never"), null);
  assert.equal(ls.length, 1);
  assert.equal(ls.key(0), ROOT_KEY);
  assert.equal(ls.key(1), null);
  const view = JSON.parse(ls.getItem("modSettings"));
  assert.deepEqual(Object.keys(view).sort(), ["demographics", "demographics-halloffame", "emigration"]);
  assert.equal(Object.keys(ls.rows()).length, 1, "one real row");
  const real = JSON.parse(ls.rows().modSettings);
  assert.equal(real[VIRTUAL_KEY]["zzz-late"], "LATE");
  assert.equal(real[MARK_KEY].root, ROOT_KEY);
  assert.equal(api.status().rootKey, ROOT_KEY);
  assert.deepEqual(api.status().virtualKeys.sort(), ["AutoMissionary.settings.v2", "zzz-late"]);
});

test("a captured reference goes through the keeper too (patched in place)", () => {
  const ls = fakeStore({ modSettings: HOF });
  const captured = ls;
  const capturedGet = ls.getItem; // a bound-at-call-time method
  install(ls, opts());
  captured.setItem("own-key", "V");
  assert.equal(captured.getItem("own-key"), "V");
  assert.notEqual(capturedGet, ls.getItem);
});

test("ModOptions helper mods: slices persist and the wipe guard never fires", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("AutoMissionary.settings.v2", AM); // a second virtual key would be a second row without the keeper
  helperSave(ls, "bz-map-trix", "showBanners", 1);
  helperSave(ls, "sib-celebratory-celebrations", "x", 7);
  assert.equal(helperLoad(ls, "bz-map-trix", "showBanners"), 1);
  assert.equal(helperLoad(ls, "sib-celebratory-celebrations", "x"), 7);
  assert.equal(helperLoad(ls, "demographics", "x"), 1, "other slices kept");
  assert.equal(ls.getItem("AutoMissionary.settings.v2"), AM, "virtual keys survive a slice write");
  assert.equal(Object.keys(ls.rows()).length, 1);
});

test("Tower-style guards see a settings root: every public value is an object", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("own", "string value");
  const view = JSON.parse(ls.getItem("modSettings"));
  assert.ok(looksLikeRoot(view));
  assert.ok(!(VIRTUAL_KEY in view) && !(MARK_KEY in view));
  assert.ok(looksLikeRoot(JSON.parse(ls.rows().modSettings)), "the real row passes the check as well");
});

test("writes are refused when the payload is not an object, never over other keys", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("k", "v");
  ls.setItem("modSettings", "not json");
  ls.setItem("modSettings", "[1,2]");
  assert.equal(ls.getItem("k"), "v");
  assert.equal(JSON.parse(ls.getItem("modSettings")).demographics.x, 1);
});

test("removeItem on a virtual key and on modSettings", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("k", "v");
  ls.removeItem("k");
  assert.equal(ls.getItem("k"), null);
  ls.setItem("k2", "v2");
  ls.removeItem("modSettings");
  assert.equal(ls.getItem("modSettings"), null, "slices gone");
  assert.equal(ls.getItem("k2"), "v2", "virtual keys kept");
  assert.equal(ls.length, 1);
});

test("clear() empties the real store, keeps the other mods' keys, and a repair-style rewrite works", () => {
  const ls = fakeStore({ modSettings: HOF, "~hidden": "H" });
  install(ls, opts());
  ls.setItem("k", "v");
  ls.clear();
  assert.equal(Object.keys(ls.rows()).length, 1);
  assert.equal(ls.getItem("k"), "v");
  assert.equal(ls.getItem("modSettings"), null);
  ls.setItem("modSettings", JSON.stringify({ demographics: { x: 2 } }));
  assert.equal(JSON.parse(ls.getItem("modSettings")).demographics.x, 2);
  assert.equal(ls.getItem("k"), "v");
});

test("empty store: nothing written until the first write, then one marked row", () => {
  const ls = fakeStore({});
  install(ls, opts());
  assert.equal(ls.length, 0);
  assert.equal(ls.getItem("modSettings"), null);
  assert.equal(ls.key(0), null);
  helperSave(ls, "m", "o", true);
  assert.equal(ls.length, 1);
  assert.equal(helperLoad(ls, "m", "o"), true);
  assert.ok(JSON.parse(ls.rows().modSettings)[MARK_KEY]);
});

test("the 2026-10-06 store: AutoMissionary row folded, the lone clobbered modSettings collapsed into a normal root", () => {
  const clobbered = JSON.stringify({ ...JSON.parse(AM), "sib-celebratory-celebrations": { _savedSfxVolume: 0.4 } });
  const ls = fakeStore({ "AutoMissionary.settings.v2": AM, modSettings: clobbered });
  const api = install(ls, opts());
  assert.deepEqual(api.status().folded, ["AutoMissionary.settings.v2"]);
  assert.equal(api.status().rootKey, ROOT_KEY, "nothing hid behind the lone row, so the store was rebuilt");
  assert.equal(api.status().blocked, false);
  assert.deepEqual(Object.keys(ls.rows()), ["modSettings"], "one real row: safe to remove the keeper later");
  assert.equal(ls.getItem("AutoMissionary.settings.v2"), AM);
  assert.equal(JSON.parse(ls.getItem("modSettings"))["sib-celebratory-celebrations"]._savedSfxVolume, 0.4);
  assert.equal(JSON.parse(ls.rows().modSettings)[BLOCKED_KEY].value, clobbered, "the row's text is kept");
  assert.equal(ls.length, 1);
});

test("a lone row of an unknown key is collapsed, and reclaimed under its key once the key is known", () => {
  const ls = fakeStore({ "ba_activations_data_backup": '{"runs":[1,2]}' });
  const api = install(ls, opts());
  assert.equal(api.status().rootKey, ROOT_KEY);
  assert.deepEqual(Object.keys(ls.rows()), ["modSettings"]);
  assert.equal(ls.getItem("ba_activations_data_backup"), null, "not readable under its key yet");
  const known = KNOWN_KEYS.concat([{ key: "ba_activations_data_backup", match: (o) => !!o && Array.isArray(o.runs) }]);
  const ls2 = fakeStore(ls.rows());
  install(ls2, { ...opts(), knownKeys: known });
  assert.equal(ls2.getItem("ba_activations_data_backup"), '{"runs":[1,2]}', "moved under its key");
  assert.equal(JSON.parse(ls2.rows().modSettings)[BLOCKED_KEY], undefined);
});

test("stale raw copies hiding behind the root are removed so the store is one row", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("tmt-compact-policy-cards", '{"_settings":{"a":1}}');
  // an older raw row of the same key, written when the keeper was not installed, sorts after modSettings
  Object.getPrototypeOf(ls).setItem.call(ls, "tmt-compact-policy-cards", '{"_settings":{"old":true}}');
  assert.equal(Object.keys(ls.rows()).length, 2);
  const ls2 = fakeStore(ls.rows());
  const api2 = install(ls2, opts());
  assert.equal(api2.status().rows, 1, "stale copy removed");
  assert.equal(ls2.getItem("tmt-compact-policy-cards"), '{"_settings":{"a":1}}', "the keeper's copy is the one kept");
});

test("an empty-object row before the root is never probed over the hidden modSettings", () => {
  const ls = fakeStore({ "CM_S1_P0_BACKUP_META": "{}", modSettings: HOF });
  const api = install(ls, opts());
  assert.equal(api.status().rootKey, FALLBACK_ROOT_KEY);
  assert.equal(ls.rows().modSettings, HOF, "hidden modSettings untouched");
});

test("a lone unmarked settings root is adopted as modSettings (nothing can hide behind one row)", () => {
  const ls = fakeStore({ modSettings: HOF });
  const api = install(ls, opts());
  assert.equal(api.status().rootKey, ROOT_KEY);
  assert.deepEqual(Object.keys(ls.rows()), ["modSettings"]);
  assert.equal(JSON.parse(ls.getItem("modSettings")).demographics.x, 1);
});

test("three foreign rows before the root, two shapes alike: all folded in order, nothing probed wrongly", () => {
  const ls = fakeStore({ "!chronicle": ARCHIVE, "AutoMissionary.settings.v2": AM, htlData: ARCHIVE + " ", modSettings: HOF });
  const api = install(ls, opts());
  assert.deepEqual(api.status().folded, ["!chronicle", "AutoMissionary.settings.v2", "htlData"]);
  assert.equal(ls.getItem("htlData"), ARCHIVE + " ");
  assert.equal(ls.getItem("!chronicle"), ARCHIVE);
  assert.equal(JSON.parse(ls.getItem("modSettings")).demographics.x, 1);
  assert.equal(Object.keys(ls.rows()).length, 1);
});

test("an unrecognised row first: fallback root under the lowest key, the row kept as a copy, reads work", () => {
  const ls = fakeStore({ "CM_S1_P0_BACKUP_META": '{"chunks":3,"checksum":"x"}', modSettings: HOF });
  const api = install(ls, opts());
  assert.equal(api.status().rootKey, FALLBACK_ROOT_KEY);
  assert.equal(api.status().blocked, true);
  assert.deepEqual(Object.keys(ls.rows()), [FALLBACK_ROOT_KEY, "CM_S1_P0_BACKUP_META", "modSettings"]);
  const real = JSON.parse(ls.rows()[FALLBACK_ROOT_KEY]);
  assert.equal(real[BLOCKED_KEY].value, '{"chunks":3,"checksum":"x"}');
  helperSave(ls, "bz-map-trix", "o", 3);
  ls.setItem("own", "v");
  assert.equal(helperLoad(ls, "bz-map-trix", "o"), 3);
  assert.equal(ls.getItem("own"), "v");
  assert.equal(ls.length, 1, "helpers never see a second row");
});

test("fallback root is found again on the next launch and clear() returns to modSettings", () => {
  const ls = fakeStore({ "CM_S1_P0_BACKUP_META": "{}", modSettings: HOF });
  install(ls, opts());
  ls.setItem("own", "v");
  const rows = ls.rows();
  assert.deepEqual(Object.keys(rows), [FALLBACK_ROOT_KEY, "CM_S1_P0_BACKUP_META", "modSettings"]);
  const ls2 = fakeStore(rows);
  const api2 = install(ls2, opts());
  assert.equal(api2.status().rootKey, FALLBACK_ROOT_KEY);
  assert.equal(ls2.getItem("own"), "v");
  ls2.clear();
  assert.equal(api2.status().rootKey, ROOT_KEY);
  assert.deepEqual(Object.keys(ls2.rows()), ["modSettings"]);
  assert.equal(ls2.getItem("own"), "v");
});

test("a marked root is recognised at once, even when a stale copy of it sits under another key", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("own", "v");
  const marked = ls.rows().modSettings;
  const ls2 = fakeStore({ modSettings: marked, "~copy": marked });
  const api2 = install(ls2, opts());
  assert.equal(api2.status().rootKey, ROOT_KEY);
  assert.deepEqual(api2.status().folded, []);
  assert.equal(ls2.getItem("own"), "v");
});

test("restart: what one launch wrote, the next reads, for own keys and slices", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("AutoMissionary.settings.v2", AM);
  helperSave(ls, "bz-map-trix", "o", "yes");
  const ls2 = fakeStore(ls.rows());
  install(ls2, opts());
  assert.equal(ls2.getItem("AutoMissionary.settings.v2"), AM);
  assert.equal(helperLoad(ls2, "bz-map-trix", "o"), "yes");
  assert.equal(helperLoad(ls2, "demographics", "x"), 1);
});

test("install is idempotent and uninstall restores the engine object", () => {
  const ls = fakeStore({ modSettings: HOF });
  const a = install(ls, opts());
  const b = install(ls, opts());
  assert.equal(a, b);
  ls.setItem("k", "v");
  a.uninstall();
  assert.equal(ls.getItem("k"), ls.rows().modSettings, "engine behaviour is back");
});

test("row 1 that is not JSON after install: reads null, writes refused, nothing destroyed", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  // another mod holding the engine's original methods writes a lower key behind the keeper's back
  Object.getPrototypeOf(ls).setItem.call(ls, "!raw", "not json");
  assert.equal(ls.getItem("modSettings"), null);
  ls.setItem("k", "v");
  assert.equal(ls.rows()["!raw"], "not json");
  assert.equal(JSON.parse(ls.rows().modSettings).demographics.x, 1, "root untouched");
  assert.ok(!("k" in (JSON.parse(ls.rows().modSettings)[VIRTUAL_KEY] || {})), "refused write did not land");
});

test("a foreign row written raw after install is never adopted as the root", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("own", "v");
  Object.getPrototypeOf(ls).setItem.call(ls, "AutoMissionary.settings.v2", AM); // a mod that ran before the keeper
  assert.equal(ls.getItem("modSettings"), null, "reads empty rather than another mod's row");
  ls.setItem("modSettings", JSON.stringify({ demographics: { x: 9 } }));
  assert.equal(ls.rows()["AutoMissionary.settings.v2"], AM, "the foreign row is untouched");
  assert.equal(JSON.parse(ls.rows().modSettings).demographics.x, 1, "the root is untouched");
  const ls2 = fakeStore(ls.rows());
  const api2 = install(ls2, opts());
  assert.deepEqual(api2.status().folded, ["AutoMissionary.settings.v2"]);
  assert.equal(ls2.getItem("own"), "v");
  assert.equal(ls2.getItem("AutoMissionary.settings.v2"), AM);
});

test("fallback mode ends on a later launch once the blocking row's key is known; hidden slices come back", () => {
  const CM = '{"chunks":3,"checksum":"x"}';
  const ls = fakeStore({ "CM_S1_P0_BACKUP_META": CM, modSettings: HOF });
  install(ls, opts());
  helperSave(ls, "bz-map-trix", "o", 3);
  helperSave(ls, "demographics", "x", 2); // newer than the hidden copy's x: 1
  ls.setItem("own", "v");
  const known = KNOWN_KEYS.concat([{ key: "CM_S1_P0_BACKUP_META", match: (o) => !!o && "chunks" in o }]);
  const ls2 = fakeStore(ls.rows());
  const api2 = install(ls2, { ...opts(), knownKeys: known });
  assert.equal(api2.status().rootKey, ROOT_KEY);
  assert.equal(api2.status().blocked, false);
  assert.deepEqual(Object.keys(ls2.rows()), ["modSettings"], "one row again");
  assert.equal(helperLoad(ls2, "bz-map-trix", "o"), 3);
  assert.equal(helperLoad(ls2, "demographics", "x"), 2, "the newer slice wins");
  assert.equal(helperLoad(ls2, "emigration", "y"), 2, "a slice only the hidden row had is back");
  assert.equal(ls2.getItem("own"), "v");
  assert.equal(ls2.getItem("CM_S1_P0_BACKUP_META"), CM, "the former blocker is a virtual key now");
});

test("fallback mode ends when the lone row behind the lifted root can be collapsed", () => {
  const CM = '{"chunks":3,"checksum":"x"}';
  const clobbered = JSON.stringify({ ...JSON.parse(AM), demographics: { x: 1 } }); // not root-shaped, nameless
  const ls = fakeStore({ "CM_S1_P0_BACKUP_META": CM, modSettings: clobbered });
  const api = install(ls, opts());
  assert.equal(api.status().rootKey, FALLBACK_ROOT_KEY, "two unnamed rows: fallback");
  ls.setItem("own", "v");
  const known = KNOWN_KEYS.concat([{ key: "CM_S1_P0_BACKUP_META", match: (o) => !!o && "chunks" in o }]);
  const ls2 = fakeStore(ls.rows());
  const api2 = install(ls2, { ...opts(), knownKeys: known });
  assert.equal(api2.status().rootKey, ROOT_KEY);
  assert.deepEqual(Object.keys(ls2.rows()), ["modSettings"]);
  assert.equal(ls2.getItem("own"), "v");
  assert.equal(ls2.getItem("CM_S1_P0_BACKUP_META"), CM);
  assert.equal(JSON.parse(ls2.getItem("modSettings")).demographics.x, 1, "slice salvaged from the collapsed row");
});

test("fallback mode stays, store unchanged, while the blocking row is still unknown", () => {
  const ls = fakeStore({ "CM_S1_P0_BACKUP_META": "{\"chunks\":3}", modSettings: HOF });
  install(ls, opts());
  ls.setItem("own", "v");
  const before = ls.rows();
  const ls2 = fakeStore(before);
  const api2 = install(ls2, opts());
  assert.equal(api2.status().rootKey, FALLBACK_ROOT_KEY);
  assert.deepEqual(ls2.rows(), before);
  assert.equal(ls2.getItem("own"), "v");
});

test("cache: a changed row text is re-read, an unchanged one is not re-parsed", () => {
  const ls = fakeStore({ modSettings: HOF });
  install(ls, opts());
  ls.setItem("k", "1");
  const w = ls.writes;
  for (let i = 0; i < 50; i++) ls.getItem("k");
  assert.equal(ls.writes, w, "reads do not write");
  assert.equal(ls.getItem("k"), "1");
});
