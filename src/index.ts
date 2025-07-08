/** biome-ignore-all lint/suspicious/noConsole: Loggind */
import { HttpMediaFile, LocalFSMediaFile } from "./file.ts";
import { ISOBMFParser } from "./isobmf.ts";

const fLocal = new LocalFSMediaFile(
    "/home/babnik/Downloads/gimai-seikatsu-s01e01.mp4"
);

const fHttp = new HttpMediaFile(
    "https://ubel.weebify.tv/gimai-seikatsu-s01e01.mp4"
);

const file = process.env.REMOTE ? fHttp : fLocal;

const p = new ISOBMFParser(
    await file.getView(0, 2_000_000)
);

try {
    console.log(p.getChaptersInfo());
} catch (e) {
    console.log('failed!', e)
}
console.log([file.identifier,  ...p.getQuirks()]);
