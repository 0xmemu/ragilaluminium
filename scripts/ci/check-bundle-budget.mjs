import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const buildDir = join(root, 'public', 'build');
const assetsDir = join(buildDir, 'assets');
const manifestPath = join(buildDir, 'manifest.json');

const budgetKb = (name, fallback) => {
    const value = Number(process.env[name] ?? fallback);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${name} must be a positive number.`);
    }

    return value;
};

const budgets = {
    entryGzip: budgetKb('BUNDLE_ENTRY_GZIP_MAX_KB', 130),
    chunkGzip: budgetKb('BUNDLE_CHUNK_GZIP_MAX_KB', 90),
    totalJsGzip: budgetKb('BUNDLE_TOTAL_JS_GZIP_MAX_KB', 500),
    cssGzip: budgetKb('BUNDLE_CSS_GZIP_MAX_KB', 25),
    image: budgetKb('BUNDLE_IMAGE_MAX_KB', 500),
};

if (!existsSync(manifestPath) || !existsSync(assetsDir)) {
    throw new Error('Vite build output is missing. Run npm run build first.');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entryFiles = new Set(
    Object.values(manifest)
        .filter((item) => item && typeof item === 'object' && item.isEntry && item.file)
        .map((item) => item.file.replace(/^assets\//, '')),
);

const walk = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const absolute = join(directory, entry.name);

        return entry.isDirectory() ? walk(absolute) : [absolute];
    });

const files = walk(assetsDir);
const errors = [];
let totalJsGzipBytes = 0;
let largestEntry = { file: 'none', bytes: 0 };
let largestChunk = { file: 'none', bytes: 0 };
let largestCss = { file: 'none', bytes: 0 };

const kb = (bytes) => bytes / 1024;
const check = (label, file, bytes, limitKb) => {
    if (kb(bytes) > limitKb) {
        errors.push(`${label} ${file}: ${kb(bytes).toFixed(2)} KB > ${limitKb} KB`);
    }
};

for (const file of files) {
    const name = relative(assetsDir, file).replaceAll('\\', '/');
    const extension = name.slice(name.lastIndexOf('.')).toLowerCase();

    if (extension === '.js') {
        const gzipBytes = gzipSync(readFileSync(file), { level: 9 }).length;
        totalJsGzipBytes += gzipBytes;

        if (entryFiles.has(name)) {
            if (gzipBytes > largestEntry.bytes) {
                largestEntry = { file: name, bytes: gzipBytes };
            }
            check('entry gzip', name, gzipBytes, budgets.entryGzip);
        } else {
            if (gzipBytes > largestChunk.bytes) {
                largestChunk = { file: name, bytes: gzipBytes };
            }
            check('chunk gzip', name, gzipBytes, budgets.chunkGzip);
        }
    }

    if (extension === '.css') {
        const gzipBytes = gzipSync(readFileSync(file), { level: 9 }).length;
        if (gzipBytes > largestCss.bytes) {
            largestCss = { file: name, bytes: gzipBytes };
        }
        check('CSS gzip', name, gzipBytes, budgets.cssGzip);
    }

    if (['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'].includes(extension)) {
        check('image', name, statSync(file).size, budgets.image);
    }
}

if (kb(totalJsGzipBytes) > budgets.totalJsGzip) {
    errors.push(
        `total JS gzip: ${kb(totalJsGzipBytes).toFixed(2)} KB > ${budgets.totalJsGzip} KB`,
    );
}

const summary = [
    `entry ${kb(largestEntry.bytes).toFixed(2)}/${budgets.entryGzip} KB`,
    `largest chunk ${kb(largestChunk.bytes).toFixed(2)}/${budgets.chunkGzip} KB`,
    `total JS ${kb(totalJsGzipBytes).toFixed(2)}/${budgets.totalJsGzip} KB`,
    `CSS ${kb(largestCss.bytes).toFixed(2)}/${budgets.cssGzip} KB`,
].join(' | ');

if (errors.length > 0) {
    console.error(`Bundle budget FAIL: ${summary}`);
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exit(1);
}

console.log(`Bundle budget PASS: ${summary}`);
