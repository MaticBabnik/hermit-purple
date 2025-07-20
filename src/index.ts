/** biome-ignore-all lint/suspicious/noConsole: Loggind */

import { LocalFSMediaFile } from "./common";
import { MatroskaParser } from "./container/matroska.ts";

const fLocal = new LocalFSMediaFile(
    "/home/babnik/Downloads/domestic-girlfriend-01.webm"
);

const p = new MatroskaParser(await fLocal.getView(0, 1_000_000));
console.log(p.readHeader());

const seg = p.readSegment();
console.dir(seg, { depth: null });

const ns = 1_000_000_000;

const chapters = (seg as any).chapters.editions[0].chapters.map((c) => ({
    start: c.start / ns,
    end: c.end / ns,
    title: c.display[0].string,
}));


console.log(chapters);