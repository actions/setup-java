import {readFile, writeFile} from 'node:fs/promises';

const sourcePath = new URL(
  '../node_modules/@actions/http-client/lib/index.js',
  import.meta.url
);
const vulnerablePattern = `req.setTimeout(this._socketTimeout || 3 * 60000, () => {
            if (socket) {
                socket.end();
            }
            handleResult(new Error(\`Request timeout: \${info.options.path}\`));
        });`;
const safePattern = `req.setTimeout(this._socketTimeout || 3 * 60000, () => {
            const timeoutError = new Error(\`Request timeout: \${info.options.path}\`);
            req.destroy(timeoutError);
            handleResult(timeoutError);
        });`;
const source = await readFile(sourcePath, 'utf8');

if (source.includes(safePattern)) {
  process.exit(0);
}

const occurrences = source.split(vulnerablePattern).length - 1;
if (occurrences !== 1) {
  throw new Error(
    `Expected one vulnerable timeout handler in ${sourcePath.pathname}, found ${occurrences}`
  );
}

await writeFile(sourcePath, source.replace(vulnerablePattern, safePattern));
