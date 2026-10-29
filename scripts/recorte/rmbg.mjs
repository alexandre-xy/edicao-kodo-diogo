import { removeBackground } from '@imgly/background-removal-node';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [inp, out] = process.argv.slice(2);
const blob = await removeBackground(pathToFileURL(inp).href, { model: 'medium', output: { format: 'image/png' } });
fs.writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
console.log('ok', out);
