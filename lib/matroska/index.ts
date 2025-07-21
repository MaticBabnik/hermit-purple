import type { Chapter, ChapterInfo, IChapterParser } from "../common";
import { assert, StreamReader } from "../common";
import { EBMLC, MKVC } from "./constants";
import { headParser, segmentParser, timestampToSeconds } from "./matroska";
import type { EBMLHead, Segment } from "./types";

const NANOSECOND = 1_000_000_000;

export class MatroskaParser implements IChapterParser {
    protected static td = new TextDecoder("utf-8", { fatal: false });
    protected view: DataView<ArrayBuffer>;
    protected reader: StreamReader;
    protected quirks = new Set<string>();

    constructor(protected initialBuf: ArrayBuffer) {
        this.view = new DataView(initialBuf);
        this.reader = new StreamReader(this.view);
    }

    public parseChapters(): ChapterInfo | undefined {
        this.reader.seek(0);

        const magic = this.reader.readU32();
        assert(
            magic === EBMLC.MAGIC,
            `File isn't EBML (got: ${magic.toString(16)})`
        );
        const header = headParser(this.reader) as unknown as EBMLHead;

        this.quirks.add(`ebml:v${header.version},read=v${header.readVersion}`);
        this.quirks.add(
            `${header.doctype}:v${header.doctypeVersion},read=v${header.doctypeReadVersion}`
        );
        this.quirks.add(
            `maxLengths:id=${header.maxIdLength},size=${header.maxSizeLength}`
        );

        assert(
            header.doctype === "matroska" || header.doctype === "webm",
            "File isn't Matroska/WebM"
        );

        assert(header.maxIdLength === 4, "Unsupported max length");

        assert(this.reader.readVLIU32() === MKVC.MASTER, "Not a segment");

        const segment = segmentParser(this.reader) as unknown as Segment;

        for (const seekhead of segment.seekheads ?? []) {
            for (const seek of seekhead.seeks ?? []) {
                this.quirks.add(`seekhead:${seek.id}@${seek.pos}`);
            }
        }

        this.quirks.add(`timestampScale:${segment.info.timestampScale}`);

        const duration = timestampToSeconds(
            segment.info.duration,
            segment.info.timestampScale
        );

        if (!segment.chapters) return undefined;
        this.quirks.add(`nEditions:${segment.chapters.editions.length}`);

        const editions = segment.chapters.editions.filter((x) => !x.hidden);
        const edition = editions.find((x) => x.default) ?? editions[0];
        if (!edition) return;

        const chapters: Chapter[] = edition.chapters.map((c) => ({
            start: c.start / NANOSECOND,
            end: typeof c.end === "number" ? c.end / NANOSECOND : undefined,
            title: c.display.flatMap(
                (d) =>
                    d.languages?.map((l) => ({
                        lang: l,
                        text: d.string,
                    })) ?? [{ lang: "unk", text: d.string }]
            ),
        }));

        return {
            chapters,
            duration,
        };
    }

    public getQuirks(): string[] {
        return [...this.quirks.values()];
    }
}
