import * as fs from "fs";
import * as stream from "stream";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import mimeDB from "mime-db";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

/**
 * @typedef {import('playwright').Browser} Browser
 */

/**
 * @typedef {{id: number, url: string}|{id: number, doi: string}} ParsedReference
 */

/**
 * @param browser {Browser}
 * @param url {string}
 * @return {Promise<string>}
 */
async function getPageAsMHTML(browser, url) {
    const page = await browser.newPage();
    try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        // Extra timeout bc some pages fade content in with an animation
        await page.waitForTimeout(1000);
        const session = await page.context().newCDPSession(page);
        const doc = await session.send('Page.captureSnapshot', {format: 'mhtml'});
        return doc.data;
    } finally {
        await page.close();
    }
}

/**
 * @param browser {Browser}
 * @param doi {string}
 * @param filename {string}
 * @return {Promise<string>}
 */
async function saveDOIAsPDFFromSciHub(browser, doi, filename) {
    const url = `https://sci-hub.st/${doi}`;
    const page = await browser.newPage();
    try {
        await page.goto(url);
        await page.waitForLoadState('load');
        const onclick = await page.locator('button', { hasText: 'save' })
            .getAttribute('onclick');
        const re = /^location\.href='(?<path>.*)'$/;
        const match = re.exec(onclick);
        if (!match) {
            throw new Error(`Failed to find reference on sci-hub: doi:${doi}`);
        }
        const pdfURL = new URL(match.groups.path, 'https://sci-hub.st');
        pdfURL.searchParams.delete('download');
        await downloadFile(pdfURL.toString(), filename);
    } catch (e) {
        if (e.name === 'TimeoutError') {
            throw new Error(`TimeoutError while accessing sci-hub - this might be because of a captcha.
                Alternatively, visit https://sci-hub.st/${doi} and download the file manually.`, { cause: e });
        }
        throw e;
    } finally {
        await page.close();
    }
}

/**
 * @param browser {Browser}
 * @param url {string}
 * @param filename {string}
 * @return {Promise<void>}
 */
async function savePageAsMHTML(browser, url, filename) {
    const mhtml = await getPageAsMHTML(browser, url);
    await fs.promises.writeFile(filename, mhtml, 'utf-8');
}

/**
 * @param url {string}
 * @param filename {string}
 * @return {Promise<void>}
 */
async function downloadFile(url, filename) {
    const ws = fs.createWriteStream(filename);
    /** @type {import('http')|import('https')} */
    let httplib = https;
    if (url.startsWith('http:')) {
        httplib = http;
    }

    await /** @type {Promise<void>} */(new Promise((resolve, reject) => {
        httplib.get(url, res => {
            stream.pipeline(res, ws, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }));
}

/**
 * @param browser {Browser}
 * @param url {string}
 * @param filename {string}
 * @return {Promise<void>}
 */
async function savePage(browser, url, filename) {
    if (filename.endsWith('.mhtml')) {
        await savePageAsMHTML(browser, url, filename);
    } else {
        await downloadFile(url, filename);
    }
}

/**
 * Make a HEAD request to a URL and return the value of the Content-Type response header.
 * Return null if the request fails or the response has a non-ok status code or no
 * Content-Type header.
 * @param url {string}
 * @return {Promise<string>}
 */
async function getMimeTypeForURL(url) {
    const response = await fetch(url, {method: 'HEAD'});
    if (!response.ok) {
        throw new Error(`HEAD ${url} returned non-ok response status code: ${response.status}`);
    }
    const contentType = response.headers.get('content-type');
    if (contentType === null) {
        throw new Error(`HEAD ${url} returned response with status code ${response.status} and no Content-Type header`);
    }
    return contentType.split(';')[0];
}

/**
 * @param id {number}
 * @param mimeType {string}
 * @param targetDirectory {string}
 * @return {string}
 */
function getPageTargetFilename(id, mimeType, targetDirectory) {
    if (mimeType === 'text/html') {
        return path.join(targetDirectory, `${id}.mhtml`);
    }
    const extension = mimeDB[mimeType]?.extensions?.[0];
    if (extension) {
        return path.join(targetDirectory, `${id}.${extension}`);
    }
    return path.join(targetDirectory, `${id}`);
}

/**
 * Return true if the given string is valid URL.
 * This is equivalent to URL.canParse (which is only available in node>=20)
 * @param url {string}
 * @return {boolean}
 */
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Find references with https: URLs or DOIs in a text.
 * Yield objects with the reference ID and URL or DOI.
 * @param text {string}
 * @return {Generator<ParsedReference>}
 */
function *extractURLsFromText(text) {
    const re = /^\[(?<id>[0-9]+)].*?((?<url>https?:\/\/\S+)|(?<doi>10\.[0-9]+\/\S+))/gm;
    let match = null;
    while ((match = re.exec(text)) !== null) {
        const id = parseInt(match.groups.id);
        if (!isNaN(id)) {
            const { url, doi } = match.groups;
            if (isValidURL(url)) {
                yield {id, url};
            } else if (doi) {
                yield {id, doi}
            }
        }
    }
}

/**
 * @param file {string}
 * @return {Promise<boolean>}
 */
async function fileExists(file) {
    try {
        const stat = await fs.promises.stat(file);
        if (stat) {
            return stat.isFile();
        }
    } catch {}

    return false;
}

/**
 * @param reference {ParsedReference}
 * @param targetDirectory {string}
 * @param browser {Browser}
 * @return {Promise<void>}
 */
async function saveReference(reference, targetDirectory, browser) {
    const {id, url, doi} = reference;
    if (url) {
        const mimeType = await getMimeTypeForURL(url);
        const targetFile = getPageTargetFilename(id, mimeType, targetDirectory);
        if (await fileExists(targetFile)) {
            console.log(`[${id}]: ${targetFile} exists, skipping`);
            return;
        }
        await savePage(browser, url, targetFile);
        console.log(`[${id}]: ${targetFile} downloaded`);
    } else if (doi) {
        const targetFile = getPageTargetFilename(id, 'application/pdf', targetDirectory);
        await saveDOIAsPDFFromSciHub(browser, doi, targetFile);
        console.log(`[${id}]: ${targetFile} downloaded`);
    }
}

/**
 * @param input {string}
 * @param targetDirectory {string}
 * @param browser {Browser}
 * @return {Promise<void>}
 */
async function extractAndSaveURLsWithBrowser(input, targetDirectory, browser) {
    for (const reference of extractURLsFromText(input)) {
        try {
            await saveReference(reference, targetDirectory, browser);
        } catch (e) {
            console.log(`[${reference.id}]: ${e}`);
        }
    }
}

/**
 * Extract IEEE-style references with URLs from the given string, and download the URL content
 * to a file in the specified directory, with the filename equal to the reference number and
 * the file extension matching the mime type of the file.
 *
 * @example
 * await extractAndSaveAllURLs(
 *   '[1] First reference. [Online]. Available: https://jfhr.de/reference-archive/example.html (Accessed: 2023-07-23)\n' +
 *   '[2] Second reference. [Online]. Available: https://jfhr.de/reference-archive/example.pdf (Accessed: 2023-07-23)',
 *   './archive/'
 * );
 * // Will create the following files:
 * // ./archive/1.mhtml
 * // ./archive/2.pdf
 *
 * @param input {string}
 * @param targetDirectory {string}
 * @return {Promise<void>}
 */
export async function extractAndSaveAllURLs(input, targetDirectory) {
    const browser = await chromium.launch();
    try {
        await extractAndSaveURLsWithBrowser(input, targetDirectory, browser);
    } finally {
        await browser.close();
    }
}
