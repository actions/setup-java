import {readFile, writeFile} from 'node:fs/promises';

const sourcePath = new URL('../node_modules/is-unsafe/src/contexts/xml.js', import.meta.url);
const vulnerablePattern = 'pattern: /-->/,';
const safePattern = 'pattern: /--!?>/,';
const source = await readFile(sourcePath, 'utf8');

// CodeQL treats this XML detector as an incomplete HTML comment-end filter.
if (source.includes(safePattern)) {
  process.exit(0);
}

const occurrences = source.split(vulnerablePattern).length - 1;
if (occurrences !== 1) {
  throw new Error(
    `Expected one ${JSON.stringify(vulnerablePattern)} in ${sourcePath.pathname}, found ${occurrences}`
  );
}

await writeFile(sourcePath, source.replace(vulnerablePattern, safePattern));
