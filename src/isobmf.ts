/** biome-ignore-all lint/suspicious/noConsole: Logging */
import { assert } from "./common.ts";
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

export class ISOBMFParser {
    protected static td = new TextDecoder("utf-8", { fatal: false });
    protected view: DataView<ArrayBuffer>;
    protected maxBytes: number;

    protected str4(offset: number): string {
        return ISOBMFParser.td.decode(
            this.initialBuf.slice(offset, offset + 4)
        );
    }

    constructor(protected initialBuf: ArrayBuffer) {
        this.view = new DataView(initialBuf);
        this.maxBytes = initialBuf.byteLength;
    }

    *boxes(start: number, end: number): Generator<BoxHeader, void, undefined> {
        let l = start;

        while (l < end) {
            const box = this.parseBoxHeader(l);
            yield box;
            l += box.size;
        }

        return;
    }

    boxesIn(b: BoxHeader) {
        return this.boxes(b.dataOffset, b.dataOffset + b.sizeAvailable);
    }

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

    parseMvhd(bh: BoxHeader) {
        const mvhd = this.parseFullBoxHeader(bh.at);

        const data: MvhdData = {
            timescale: 0,
            duration: 0n,
            rate: 0,
        };

        const sr = new StreamReader(this.view, mvhd.dataOffset);

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

        return data;
    }

    parseChpl(bh: BoxHeader, _: MvhdData) {
        const chpl = this.parseFullBoxHeader(bh.at);

        const sr = new StreamReader(this.view, chpl.dataOffset);

        const chapters = [] as Chapter[];

        if (chpl.version !== 0) {
            // see the '???' comment in ffmpeg commit
            // 105b37859b97115cb686b291e93c5a588969b2d9
            sr.skip(4);
        } else {
            console.warn("chpl v0 encountered, timescale is probably wrong");
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

    getChapters() {
        const moov = this.boxes(32, this.initialBuf.byteLength).find(
            (x) => x.name === "moov"
        );
        if (!moov) throw new Error("Could not find moov box");

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

        console.log(tracks.map((x) => this.parseTrack(x)));

        if (udta) {
            const chpl = this.boxesIn(udta).find((x) => x.name === "chpl");
            if (chpl) {
                return this.parseChpl(chpl, timeData);
            }
        }

        return;
    }

    parseBoxHeader(byteOffset: number = 0): BoxHeader {
        const size = this.view.getUint32(byteOffset, false);

        const name = this.str4(byteOffset + 4);

        assert(size !== 1, "unsupported size");
        if (name === "uuid") {
            console.warn("UUID chunk found");
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

    parseFullBoxHeader(byteOffset: number): FullBoxHeader {
        const size = this.view.getUint32(byteOffset, false);

        const name = this.str4(byteOffset + 4);

        assert(size !== 1, "unsupported size");
        if (name === "uuid") {
            console.warn("UUID chunk found");
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

    parseFtype() {
        const ftype = this.parseBoxHeader(0);
        assert(ftype.name === "ftyp", "non ftype header");

        const major = this.str4(ftype.dataOffset);
        const minor = this.view.getUint32(ftype.dataOffset + 4);

        const brands = [] as string[];

        for (let o = ftype.dataOffset + 8; o < ftype.size; o += 4) {
            brands.push(this.str4(o));
        }

        return { box: ftype, major, minor, brands };
    }

    public verifyFiletype() {
        const r = this.parseFtype();
        assert(r.brands.includes("iso2"), "unsupported isobmf");
    }

    private static MEDIA_TYPE_HEADER = /^[vshng]mhd$/;
    private static MEDIA_TYPE_MAP = {
        vmhd: "video",
        smhd: "audio",
        nmhd: "null",
        hmhd: "hint",
        gmhd: "thing",
        undefined: "unknown",
    } as Record<string, string | undefined>;

    private parseTrack(bh: BoxHeader) {
        const { mdia } = this.assertBoxesIn(bh, "tkhd", "mdia");

        const { minf } = this.assertBoxesIn(mdia, "minf");

        const type = this.boxesIn(minf).find((x) =>
            ISOBMFParser.MEDIA_TYPE_HEADER.test(x.name)
        );

        if (type?.name !== "gmhd")
            return {
                type: ISOBMFParser.MEDIA_TYPE_MAP[`${type?.name}`] ?? "unknown",
            };

        console.log([...this.boxesIn(type)]);

        return { type: "thing" };
    }
}
