// Rewrites the coverage badge in README.md from coverage/coverage-summary.json.
// Runs as part of `npm run test:coverage` — no external coverage service needed.
import { readFileSync, writeFileSync } from 'node:fs';

const summary = JSON.parse(
  readFileSync(new URL('../coverage/coverage-summary.json', import.meta.url), 'utf8'),
);
const pct = summary.total.statements.pct;
const color =
  pct >= 90 ? 'brightgreen' : pct >= 80 ? 'green' : pct >= 70 ? 'yellow' : 'red';
const badge = `![coverage](https://img.shields.io/badge/coverage-${pct}%25-${color})`;

const readmeUrl = new URL('../README.md', import.meta.url);
const readme = readFileSync(readmeUrl, 'utf8');
const updated = readme.replace(
  /!\[coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-[^)]+\)/,
  badge,
);
if (!updated.includes(badge)) {
  console.error('README.md coverage badge placeholder not found');
  process.exit(1);
}
if (updated !== readme) {
  writeFileSync(readmeUrl, updated);
  console.log(`README coverage badge updated: ${pct}%`);
} else {
  console.log(`README coverage badge already current: ${pct}%`);
}
