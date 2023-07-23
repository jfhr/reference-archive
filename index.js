import * as fs from "fs";
import { extractAndSaveAllURLs } from "./lib.js";

async function main() {
    const inputFile = process.argv[2];
    const targetDirectory = process.argv[3];
    if (!inputFile || !targetDirectory) {
        console.error('Syntax: node index.js FILE TARGET');
        process.exitCode = -1;
        return;
    }

    const input = await fs.promises.readFile(inputFile, 'utf-8');
    await fs.promises.mkdir('archive', { recursive: true });

    await extractAndSaveAllURLs(input, targetDirectory);
}

main();
