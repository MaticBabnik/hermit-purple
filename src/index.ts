/** biome-ignore-all lint/suspicious/noConsole: Loggind */
import { HttpMediaFile, LocalFSMediaFile } from "./file.ts";
import { ISOBMFParser } from "./isobmf.ts";

const fLocal = new LocalFSMediaFile(
    "/home/babnik/Downloads/gimai-seikatsu-s01e01.mp4"
);

const fHttp = new HttpMediaFile(
    "https://ubel.weebify.tv/gimai-seikatsu-s01e01.mp4"
);

const p = new ISOBMFParser(await (process.env.REMOTE ? fHttp : fLocal).getView(0, 10_000_000));

console.log(p.getChapters());
