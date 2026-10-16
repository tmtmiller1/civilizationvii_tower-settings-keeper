#!/usr/bin/env node
// carriers.mjs: list every Tower mod that carries settings-keeper.js, with each copy's BUILD and hash, and copy a new
// build into them when one goes out. See CONTRIBUTING.md, "Sending out a new BUILD".
//
//   node scripts/carriers.mjs                 list the copies each mod's modinfo loads (read-only)
//   node scripts/carriers.mjs --dist          also list the copies in each mod's dist/ (its last built release)
//   node scripts/carriers.mjs --write         show which copies a write would replace, and stop
//   node scripts/carriers.mjs --write --yes   replace them with this repo's ui/settings-keeper.js
//   --root <dir>                              the folder that holds the mods (default: the folder above this repo)
//
// The list exits 1 when a copy differs from this repo's file, when a modinfo doesn't list the file first in a
// UIScripts group, or when a modinfo names a copy that isn't there. A write replaces a copy only when this repo's
// BUILD is higher than the copy's and the copy has no uncommitted changes in its own repo. A copy with the same BUILD
// and different bytes stops the write: either this repo's BUILD wasn't raised, or someone edited the copy.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = 'settings-keeper.js';
const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const rootAt = args.indexOf('--root');
const ROOT = rootAt >= 0 ? resolve(args[rootAt + 1]) : dirname(HERE);
const SOURCE = join(HERE, 'ui', FILE);

const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
const buildOf = (path) => Number((/export const BUILD = (\d+)/.exec(readFileSync(path, 'utf8')) || [])[1] || NaN);
const isDir = (path) => { try { return statSync(path).isDirectory(); } catch (_) { return false; } };

/** Every UIScripts block in a modinfo, comments removed, as lists of item paths. */
function uiScriptGroups(text) {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '');
  return [...clean.matchAll(/<UIScripts>([\s\S]*?)<\/UIScripts>/g)]
    .map((m) => [...m[1].matchAll(/<Item[^>]*>([^<]+)<\/Item>/g)].map((i) => i[1].trim()));
}

/** settings-keeper.js files anywhere under a folder, skipping folders that never ship. */
function findCopies(dir, skip) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (isDir(p)) { if (!skip.has(name)) out.push(...findCopies(p, skip)); } else if (name === FILE) out.push(p);
  }
  return out;
}

/** One mod folder: the copies its modinfo loads, whether each is first in its groups, and strays under ui/. */
function inspectMod(dir) {
  const modinfo = readdirSync(dir).find((n) => n.endsWith('.modinfo'));
  if (!modinfo) return null;
  const groups = uiScriptGroups(readFileSync(join(dir, modinfo), 'utf8'))
    .filter((g) => g.some((i) => basename(i) === FILE));
  if (!groups.length) return null;
  const paths = [...new Set(groups.flat().filter((i) => basename(i) === FILE))];
  const first = groups.filter((g) => basename(g[0]) === FILE).length;
  const rows = paths.map((p) => ({ dir, rel: p, path: join(dir, p), groups: groups.length, first }));
  const listed = new Set(rows.map((r) => r.path));
  const strays = isDir(join(dir, 'ui')) ? findCopies(join(dir, 'ui'), new Set()).filter((p) => !listed.has(p)) : [];
  for (const p of strays) rows.push({ dir, rel: relative(dir, p), path: p, stray: true });
  return rows;
}

function describe(row, src) {
  if (!existsSync(row.path)) return { ...row, missing: true, ok: false };
  const build = buildOf(row.path); const sha = hash(row.path);
  const same = sha === src.sha;
  const firstOk = row.stray || row.first === row.groups;
  return { ...row, build, sha, same, ok: same && firstOk && !row.stray };
}

function distRows(dir) {
  const d = join(dir, 'dist');
  return isDir(d) ? findCopies(d, new Set()).map((p) => ({ dir, rel: relative(dir, p), path: p, dist: true })) : [];
}

function printTable(rows) {
  const w = Math.max(...rows.map((r) => basename(r.dir).length), 10);
  const v = Math.max(...rows.map((r) => r.rel.length), 4);
  const head = ['mod folder'.padEnd(w), 'copy'.padEnd(v), 'BUILD', 'sha256      ', 'same', 'first in UIScripts'];
  console.log(head.join('  '));
  for (const r of rows) {
    const first = r.dist ? '(dist)' : r.stray ? 'not in the modinfo' : r.first + ' of ' + r.groups;
    const cells = r.missing ? ['-'.padEnd(5), 'missing'.padEnd(12), 'no  ', first]
      : [String(r.build).padEnd(5), r.sha, (r.same ? 'yes' : 'NO').padEnd(4), first];
    console.log([basename(r.dir).padEnd(w), r.rel.padEnd(v), ...cells].join('  '));
  }
}

function gitDirty(dir, rel) {
  try {
    return execFileSync('git', ['-C', dir, 'status', '--porcelain', '--', rel],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() !== '';
  } catch (_) {
    return null; // not a git repository
  }
}

/** What a write would do with each copy that differs. */
function plan(rows, src) {
  return rows.filter((r) => !r.dist && !r.missing && !r.same).map((r) => {
    if (!(src.build > r.build)) {
      const why = r.build === src.build ? 'same BUILD, different bytes' : 'copy has a newer BUILD';
      return { r, action: 'stop', why };
    }
    const dirty = gitDirty(r.dir, r.rel);
    if (dirty === null) return { r, action: 'stop', why: 'not in a git repository' };
    if (dirty) return { r, action: 'stop', why: 'uncommitted changes to the copy' };
    return { r, action: 'copy', why: 'BUILD ' + r.build + ' -> ' + src.build };
  });
}

function write(rows, src) {
  const steps = plan(rows, src);
  if (!steps.length) { console.log('\nwrite: every copy already matches; nothing to do'); return 0; }
  console.log('\nwrite plan:');
  for (const s of steps) console.log('  ' + s.action.padEnd(5) + basename(s.r.dir) + '/' + s.r.rel + ': ' + s.why);
  if (steps.some((s) => s.action === 'stop')) {
    console.log('write: stopped; fix the lines marked stop first');
    return 1;
  }
  if (!flag('--yes')) { console.log('write: add --yes to copy'); return 0; }
  for (const s of steps) copyFileSync(SOURCE, s.r.path);
  console.log('write: copied ' + steps.length + ' file(s). Each mod now needs a commit and a release of its own.');
  return 0;
}

function main() {
  const src = { build: buildOf(SOURCE), sha: hash(SOURCE) };
  console.log('this repo: ui/' + FILE + ' BUILD ' + src.build + ', sha256 ' + src.sha + ' (first 12 hex digits)');
  console.log('mods under ' + ROOT + '\n');
  const mods = readdirSync(ROOT).map((n) => join(ROOT, n)).filter(isDir).sort();
  let rows = [];
  for (const dir of mods) {
    const own = inspectMod(dir);
    if (own) rows.push(...own);
    if (own && flag('--dist')) rows.push(...distRows(dir));
  }
  rows = rows.map((r) => describe(r, src));
  printTable(rows);
  const loaded = rows.filter((r) => !r.dist);
  const bad = loaded.filter((r) => !r.ok);
  const carriers = new Set(loaded.map((r) => r.dir)).size;
  console.log('\n' + loaded.length + ' copies in ' + carriers + ' mod folders: ' + (loaded.length - bad.length) +
    ' match and are listed first, ' + bad.length + ' need a look' +
    (flag('--dist') ? '; dist copies are listed for reference and not counted' : ''));
  if (flag('--write')) return write(rows, src);
  return bad.length ? 1 : 0;
}

process.exitCode = main();
