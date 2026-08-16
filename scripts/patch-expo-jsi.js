#!/usr/bin/env node
/**
 * postinstall — patch expo-modules-jsi 57.0.4 for Xcode 26 Swift compiler.
 *
 * Fixes:
 *   1. `weak let` → `weak var` (Swift 6 no longer allows immutable weak refs)
 *   2. Add `nonisolated(unsafe)` to mutable weak `runtime` in Sendable classes
 *   3. Cast for the Date "abs(milliseconds) <= ..." comparison
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI');

if (!fs.existsSync(BASE)) {
  // expo-modules-jsi not installed yet (first pass of postinstall) — nothing to do
  process.exit(0);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

let patched = 0;

// 1. weak let → weak var everywhere under Sources
for (const file of walk(BASE)) {
  if (!file.endsWith('.swift')) continue;
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  src = src.replace(/\bweak let\b/g, 'weak var');
  if (src !== orig) {
    fs.writeFileSync(file, src);
    patched++;
  }
}

// 2. Add nonisolated(unsafe) to specific Sendable classes' mutable weak refs
const SENDABLE_FILES = [
  'Contexts/HostFunctionContext.swift',
  'Contexts/HostObjectContext.swift',
  'Runtime/JavaScriptPropNameID.swift',
  'Runtime/Values/JavaScriptError.swift',
  'Runtime/Values/JavaScriptValue.swift',
];

for (const rel of SENDABLE_FILES) {
  const file = path.join(BASE, rel);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  // Only add if not already present
  src = src.replace(
    /^(\s*)(?!nonisolated\(unsafe\)\s)((?:internal|private|public)?\s*weak var runtime)/gm,
    (_m, indent, decl) => `${indent}nonisolated(unsafe) ${decl}`,
  );
  if (src !== orig) {
    fs.writeFileSync(file, src);
    patched++;
  }
}

// 3. Fix the Date abs() comparison
const dateFile = path.join(BASE, 'Coding', 'JavaScriptCodable+Date.swift');
if (fs.existsSync(dateFile)) {
  let src = fs.readFileSync(dateFile, 'utf8');
  const orig = src;
  src = src.replace(
    'guard milliseconds.isFinite, abs(milliseconds) <= maxJavaScriptDateMilliseconds else {',
    'let absMs: Double = Swift.abs(milliseconds); guard milliseconds.isFinite, absMs <= maxJavaScriptDateMilliseconds else {',
  );
  if (src !== orig) {
    fs.writeFileSync(dateFile, src);
    patched++;
  }
}

console.log(`  expo-modules-jsi: patched ${patched} file(s) for Xcode 26 compatibility`);
