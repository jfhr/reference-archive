import { test } from "node:test";
import * as fs from "fs/promises";
import * as assert from "node:assert/strict";
import { extractAndSaveAllURLs } from "./lib.js";

test('extractAndSaveAllURLs', async context => {
    await fs.rm('./archive/', { recursive: true, force: true });
    await fs.mkdir('./archive/', { recursive: true });

    await context.test('reference from PDF file', async () => {
        await extractAndSaveAllURLs(
            '[1] First reference. [Online]. Available: https://jfhr.de/reference-archive/example.pdf (Accessed: 2023-07-23)',
            './archive/'
        );
        const stat = await fs.stat('./archive/1.pdf');
        assert.ok(stat.isFile());
    });

    await context.test('reference from website', async () => {
        await extractAndSaveAllURLs(
            '[2] Second reference. [Online]. Available: https://jfhr.de/reference-archive/example.html (Accessed: 2023-07-23)',
            './archive/'
        );
        const stat = await fs.stat('./archive/2.mhtml');
        assert.ok(stat.isFile());
    });

    await context.test('reference from client-rendered website', async () => {
        await extractAndSaveAllURLs(
            '[3] Third reference. [Online]. Available: https://jfhr.de/reference-archive/cr.html (Accessed: 2023-07-23)',
            './archive/'
        );
        const stat = await fs.stat('./archive/3.mhtml');
        assert.ok(stat.isFile());
        const html = await fs.readFile('./archive/3.mhtml', 'utf-8');
        assert.ok(html.includes('this string is client-rendered'));
    });

    await context.test('reference from DOI', async () => {
        await extractAndSaveAllURLs(
            '[4] S. DeRisi, R. Kennison and N. Twyman: The What and Whys of DOIs. doi: 10.1371/journal.pbio.0000057',
            './archive/'
        );
        const stat = await fs.stat('./archive/4.pdf');
        assert.ok(stat.isFile());
    });
});
