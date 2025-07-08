import { assert, nn } from "./common.ts";
import { StreamReader } from "./stream.ts";

interface BoxHeader {
    /**
     * Offset to start of box
     */
    at: number;

    /**
     * Total size of box
     */
    size: number;

    /**
     * Type of box
     */
    name: string;

    /**
     * Offset to start of box data
     */
    dataOffset: number;

    /**
     * How much data is actually available
     */
    sizeAvailable: number;
}

interface FullBoxHeader extends BoxHeader {
    version: number;
    flags: number;
}

interface Chapter {
    time: number;
    title: string;
}

interface MvhdData {
    duration: bigint;
    timescale: number;
    rate: number;
}

interface Ftyp {
    box: BoxHeader;
    major: string;
    minor: number;
    brands: string[];
}

type SttsEntries = [number, number][];
type StscEntries = [number, number, number][];
type StszEntries = number[] & { default: number };
type StcoEntries = number[];

interface Samples {
    stts: SttsEntries;
    stsc: StscEntries;
    stsz: StszEntries;
    stco: StcoEntries;
}

interface ChaptersData {
    duration: number;
    chapters: Chapter[];
}

export class ISOBMFParser {
    protected static td = new TextDecoder("utf-8", { fatal: false });
    protected view: DataView<ArrayBuffer>;
    protected maxBytes: number;
    protected quirks = new Set<string>()

    constructor(protected initialBuf: ArrayBuffer) {
        this.view = new DataView(initialBuf);
        this.maxBytes = initialBuf.byteLength;
    }

    /**
     * Reads file type header
     */
    public readFtyp(): Ftyp {
        const ftype = this.parseBoxHeader(0);
        assert(ftype.name === "ftyp", "non ftype header");

        const major = this.str4(ftype.dataOffset);
        const minor = this.view.getUint32(ftype.dataOffset + 4);

        const brands = [] as string[];

        for (let o = ftype.dataOffset + 8; o < ftype.size; o += 4) {
            const brand = this.str4(o);
            brands.push(brand);
            this.quirks.add(`brand:${brand}`)
        }

        return { box: ftype, major, minor, brands };
    }

    /**
     * fails if file isn't supported
     */
    public verifyFiletype(): void {
        const r = this.readFtyp();
        assert(r.brands.includes("iso2"), "unsupported isobmf");
    }

    /**
     * Tries to read nero/flash or quicktime chapters from the file. \
     * Will throw if anything goes wrong, will return undefined if no chapters are present.
     */
    public getChaptersInfo(): ChaptersData | undefined {
        const moov = this.boxes(32, this.initialBuf.byteLength).find(
            (x) => x.name === "moov"
        );
        if (!moov) throw new Error("Could not find moov box");

        if (moov.sizeAvailable !== moov.size) {
            this.quirks.add(`partialMoov(${moov.sizeAvailable - moov.size})`)
        }

        const tracks = [] as BoxHeader[];
        let mvhd: BoxHeader | undefined;
        let udta: BoxHeader | undefined;

        for (const box of this.boxesIn(moov)) {
            switch (box.name) {
                case "trak":
                    tracks.push(box);
                    break;
                case "mvhd":
                    mvhd = box;
                    break;
                case "udta":
                    udta = box;
                    break;
            }
        }

        if (!mvhd) throw new Error("Missing mvhd");

        const timeData = this.parseMvhd(mvhd);
        const duration = Number(timeData.duration) / timeData.timescale;

        let chapterError: unknown | undefined;

        if (udta) {
            this.quirks.add('has:udta');
            const chpl = this.boxesIn(udta).find((x) => x.name === "chpl");
            if (chpl) {
                this.quirks.add('has:chpl');
                try {
                    return {
                        duration,
                        chapters: this.parseChpl(chpl, timeData),
                    };
                } catch (e) {
                    chapterError = e;
                }
            }
        }

        const chaptersTrack = tracks
            .map((x) => {
                try {
                    return this.tryParseChaptersTrak(x);
                } catch {
                    return;
                }
            })
            .find((x) => x);

        if (chaptersTrack) {
            this.quirks.add('has:chaptersTrack');
            return {
                duration,
                chapters: this.readChapterSamples(chaptersTrack, timeData),
            };
        }

        if (chapterError) throw chapterError;
    }

    public getQuirks(): string[] {
        return [...this.quirks.values()]
    }

    //#region Box Level APIs

    /**
     * Reads chapter samples from a proper track \
     * This makes a ton of assumptions, most importantly: \
     *  - The chapters are all contained in a single chunk
     *  - Chapters start at 0:00 (no edits on track)
     */
    private readChapterSamples(
        { stsc, stts, stsz, stco }: Samples,
        timeData: MvhdData
    ): Chapter[] {
        const chapters: Chapter[] = [];

        assert(
            stsc.length === 1 && stsc[0]?.[0] === 1 && stsc[0]?.[2] === 1,
            "Complex samples :("
        );
        const nChapters = stsc[0][1];
        // The fact these are chapters kinda guarantees that this won't get crazy big.
        const times = stts.flatMap(([n, ts]) =>
            [...Array(n)].map(() => ts / timeData.timescale)
        );
        const chunkBase = nn(stco[0], "Missing stco entry");

        if (chunkBase > this.initialBuf.byteLength) {
            this.quirks.add(`chaptersOOB(${this.initialBuf.byteLength - chunkBase})`)
        }

        const sr = new StreamReader(this.view);

        for (let i = 0, addr = chunkBase, time = 0; i < nChapters; i++) {
            sr.seek(addr);
            chapters.push({
                time,
                title: sr.readStrPU16(),
            });
            time += nn(times[i]);
            addr += nn(stsz[i]);
        }

        return chapters;
    }

    /**
     * Attempts to parse a "trak" box as chapters data. \
     * This __will__ throw if trak isn't text or if anything else goes wrong
     */
    private tryParseChaptersTrak(
        bh: BoxHeader
    ): { type: "chapters" } & Samples {
        // TODO(mbabnik): return undefined when file isn't assumed to be chapter data
        // (only throw errors when chapter-related stuff goes wrong)

        const { mdia } = this.assertBoxesIn(bh, "mdia");
        const { minf, hdlr } = this.assertBoxesIn(mdia, "minf", "hdlr");
        assert(this.parseHdlr(hdlr) === "text", "Incorrect handler");
        const { stbl } = this.assertBoxesIn(minf, "gmhd", "stbl");
        const { stts, stsc, stsz, stco } = this.assertBoxesIn(
            stbl,
            "stts",
            "stsc",
            "stsz",
            "stco"
        );

        return {
            type: "chapters",
            stts: this.parseStts(stts),
            stsc: this.parseStsc(stsc),
            stsz: this.parseStsz(stsz),
            stco: this.parseStco(stco),
        };
    }

    /**
     * Parses a chpl box; \
     * Returns real `Chapter`s as it seems that chpl doesn't respect timescale.
     */
    private parseChpl(bh: BoxHeader, _: MvhdData): Chapter[] {
        const chpl = this.parseFullBoxHeader(bh.at);

        const sr = new StreamReader(this.view, chpl.dataOffset);

        const chapters = [] as Chapter[];

        if (chpl.version !== 0) {
            // see the '???' comment in ffmpeg commit
            // 105b37859b97115cb686b291e93c5a588969b2d9
            sr.skip(4);
            this.quirks.add('chpl:v1-nero')
        } else {
            this.quirks.add('chpl:v0-flv')
        }

        const nChapters = sr.readU8();

        for (let i = 0; i < nChapters; i++) {
            const ts = sr.readU64();
            const title = sr.readStrPU8();

            chapters.push({
                time: Number(ts / 10000n) / 1000,
                title: title,
            });
        }

        return chapters;
    }

    parseMvhd(bh: BoxHeader): MvhdData {
        const mvhd = this.parseFullBoxHeader(bh.at);

        const data: MvhdData = {
            timescale: 0,
            duration: 0n,
            rate: 0,
        };

        const sr = new StreamReader(this.view, mvhd.dataOffset);

        this.quirks.add(`mvhd:v${mvhd.version}`);

        if (mvhd.version === 0) {
            sr.skip(8);
            data.timescale = sr.readU32();
            data.duration = BigInt(sr.readU32());
        } else if (mvhd.version === 1) {
            sr.skip(16);
            data.timescale = sr.readU32();
            data.duration = sr.readU64();
        } else throw new Error("Unsupported MVHD version");
        data.rate = sr.readFixed32();

        if (data.rate !== 1) this.quirks.add(`rate:${data.rate}`);

        return data;
    }

    /**
     * Parse trak handler box
     */
    private parseHdlr(bh: BoxHeader) {
        const sr = new StreamReader(this.view, bh.dataOffset);

        assert(sr.readU8() === 0, "Unsupported version of hdlr");
        sr.skip(7);

        return sr.readStr(4);
    }

    /**
     * Parse sample timestamps
     */
    private parseStts(bh: BoxHeader): SttsEntries {
        const sr = new StreamReader(this.view, bh.dataOffset);

        assert(sr.readU8() === 0, "Unsupported version of stts");
        sr.skip(3);

        const nEntries = sr.readU32();

        const entries = Array(nEntries) as SttsEntries;

        for (let i = 0; i < nEntries; i++) {
            entries[i] = [sr.readU32(), sr.readU32()];
        }

        return entries;
    }

    /**
     * Parse sample-chunk groups
     */
    private parseStsc(bh: BoxHeader): StscEntries {
        const sr = new StreamReader(this.view, bh.dataOffset);

        assert(sr.readU8() === 0, "Unsupported version of stsc");
        sr.skip(3);

        const nEntries = sr.readU32();

        const entries = Array(nEntries) as StscEntries;

        for (let i = 0; i < nEntries; i++) {
            entries[i] = [sr.readU32(), sr.readU32(), sr.readU32()];
        }

        return entries;
    }

    /**
     * Parse sample sizes
     */
    private parseStsz(bh: BoxHeader): StszEntries {
        const sr = new StreamReader(this.view, bh.dataOffset);

        assert(sr.readU8() === 0, "Unsupported version of stsz");
        sr.skip(3);

        const sampleSize = sr.readU32();
        const nEntries = sr.readU32();

        const entries = Array(nEntries) as StszEntries;
        entries.default = sampleSize;

        for (let i = 0; i < nEntries; i++) {
            entries[i] = sr.readU32();
        }

        return entries;
    }

    /**
     * Parse chunk offsets
     */
    private parseStco(bh: BoxHeader): StcoEntries {
        const sr = new StreamReader(this.view, bh.dataOffset);

        assert(sr.readU8() === 0, "Unsupported version of stco");
        sr.skip(3);

        const nEntries = sr.readU32();
        const entries = Array(nEntries) as number[];

        for (let i = 0; i < nEntries; i++) {
            entries[i] = sr.readU32();
        }

        return entries;
    }

    /**
     * Aserts that a box contains exactly one of each box type (and returns their headers)
     */
    assertBoxesIn<TBoxTag extends string>(
        b: BoxHeader,
        ...boxes: TBoxTag[]
    ): Record<TBoxTag, BoxHeader> {
        const result: Partial<Record<TBoxTag, BoxHeader>> = {};

        for (const box of this.boxesIn(b)) {
            const tag = box.name as TBoxTag;
            if (tag in result)
                throw new Error(`Duplicate box ${tag} in ${b.name}@${b.at}`);
            if (boxes.includes(tag)) result[tag] = box;
        }

        const missing = boxes.find((x) => !(x in result));
        if (missing)
            throw new Error(`Missing box ${missing} in ${b.name}@${b.at}`);

        return result as Record<TBoxTag, BoxHeader>;
    }

    /**
     * Returns a Generator of BoxHeaders that are inside another Box
     */
    boxesIn(b: BoxHeader): Generator<BoxHeader, void, undefined> {
        return this.boxes(b.dataOffset, b.dataOffset + b.sizeAvailable);
    }

    //#endregion Box Level APIs

    //#region bitstream Level APIs

    /**
     * Returns a Generator of BoxHeaders from a region of the initialBuffer \
     * `start` __must__ point to the begining of a Box. `end` does not have to be aligned to box boundaries.
     */
    *boxes(start: number, end: number): Generator<BoxHeader, void, undefined> {
        let l = start;

        while (l < end) {
            try {
                const box = this.parseBoxHeader(l);
                yield box;
                l += box.size;
            } catch (_) {
                this.quirks.add(`warn:partial_boxes_call@[${start}-${end}, err=${l}]`)
                return;
            }
        }

        return;
    }

    /**
     * Parses a Box header
     */
    private parseBoxHeader(byteOffset: number = 0): BoxHeader {
        const size = this.view.getUint32(byteOffset, false);

        const name = this.str4(byteOffset + 4);

        assert(size !== 1, "unsupported size");
        if (name === "uuid") {
            this.quirks.add('uuid');
        }

        return {
            at: byteOffset,
            size,
            name,
            dataOffset: byteOffset + 8,
            sizeAvailable: Math.min(
                this.initialBuf.byteLength - byteOffset,
                size
            ),
        };
    }

    /**
     * Parses a FullBox header (Box + version and flags)
     */
    private parseFullBoxHeader(byteOffset: number): FullBoxHeader {
        const size = this.view.getUint32(byteOffset, false);

        const name = this.str4(byteOffset + 4);

        assert(size !== 1, "unsupported size");
        if (name === "uuid") {
            this.quirks.add('uuid');
        }
        const flagsAndVersion = this.view.getUint32(byteOffset + 8, false);

        return {
            at: byteOffset,
            size,
            name,
            dataOffset: byteOffset + 12,
            version: (flagsAndVersion >> 24) & 0xff,
            flags: flagsAndVersion & 0xffffff,
            sizeAvailable: Math.min(
                this.initialBuf.byteLength - byteOffset,
                size
            ),
        };
    }

    private str4(offset: number): string {
        return ISOBMFParser.td.decode(
            this.initialBuf.slice(offset, offset + 4)
        );
    }

    //#endregion bitstream Level APIs
}
