import { copyFileSync, existsSync } from 'node:fs';

const source = new URL('../dist/forma/3rdpartylicenses.txt', import.meta.url);
const destination = new URL('../dist/forma/browser/3rdpartylicenses.txt', import.meta.url);
if (existsSync(source)) copyFileSync(source, destination);
