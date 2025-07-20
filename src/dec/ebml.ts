import { StreamError, type StreamReader } from "../common";
import { EBMLC, MKVC, SEGMENT_CHILD_ID_TO_NAME } from "../mkvconst";

type ParserFun = (sr: StreamReader, id: number) => unknown;

// biome-ignore lint/suspicious/noConstEnum: Perf
export const enum KN {
    OPT,
    REQ,
    OMUL,
    MUL,
}

const BIT_REQ = 1,
    BIT_MUL = 2;

export type DecType = [
    string, // key
    ParserFun, // handler
    KN, // Optional? Required? Multiple?
];

export function error(_: StreamReader, id: number): never {
    throw new Error(`Unsupported element ${id.toString(16)}`);
}

export function ignore(r: StreamReader) {
    // const xx = r.readVLIBU();
    const x = r.readVLIU32();
    r.skip(x);
}

export function uintD(defaultValue = 0) {
    return (r: StreamReader) => {
        const x = r.readVLIU32();

        switch (x) {
            case 0:
                return defaultValue;
            case 1:
                return r.readU8();
            case 2:
                return r.readU16();
            case 3:
                return r.readU24();
            case 4:
                return r.readU32();

            case 5:
            case 6:
            case 7: {
                const b = BigInt(r.readU32()) << BigInt((x - 4) * 8);

                return Number(
                    b |
                        BigInt(
                            x === 5
                                ? r.readU8()
                                : x === 6
                                  ? r.readU16()
                                  : r.readU24()
                        )
                );
            }

            case 8:
                return Number(r.readU64());
            default:
                throw new Error(`Unsupported size ${x}`);
        }
    };
}

export const uint = uintD(0);

export function bool(r: StreamReader) {
    return !!uint(r);
}

const uint1 = uintD(1);
export function boolT(r: StreamReader) {
    return !!uint1(r);
}

export function string(r: StreamReader) {
    const x = r.readVLIU32();
    return r.readStr(x);
}

export function seekheadId(r: StreamReader) {
    const id = uint(r);

    return SEGMENT_CHILD_ID_TO_NAME[id] ?? `unk-${id.toString(16)}`;
}

export function master(def: Record<number, DecType>, allowUnknown = true) {
    return (sr: StreamReader) => {
        const obj = {} as Record<string, unknown>;
        const size = sr.readVLIU32();
        const end = sr.position + size;

        while (sr.position < end) {
            let id: number;
            let result: unknown;

            try {
                id = sr.readVLIU32();
            } catch (e) {
                if (e instanceof StreamError) {
                    break;
                }
                throw e;
            }

            const handler = def[id];
            if (!handler) {
                if (!allowUnknown) throw new Error(`Unknown ID ${id}`);
                ignore(sr);
                continue;
            }

            try {
                result = handler[1]?.(sr, id);
            } catch (e: unknown) {
                if (e instanceof StreamError) continue;
                throw e;
            }

            if (handler[2] & BIT_MUL) {
                if (handler[0] in obj) {
                    (obj[handler[0]] as unknown[]).push(result);
                } else {
                    obj[handler[0]] = [result];
                }
            } else {
                if (handler[0] in obj) {
                    throw new Error("Duplicate record");
                } else {
                    obj[handler[0]] = result;
                }
            }
        }

        for (const r of Object.values(def)) {
            if (r[2] & BIT_REQ && !(r[0] in obj)) {
                throw new Error(`Missing required ${r[0]}`);
            }
        }

        return obj;
    };
}

export interface EBMLHead {
    version: number;
    readVersion: number;
    maxIdLength: number;
    maxSizeLength: number;
    doctype: string;
    doctypeVersion: number;
    doctypeReadVersion?: number;
}

export const HEAD_PARSER = master({
    [EBMLC.VER]: ["version", uintD(1), KN.REQ],
    [EBMLC.READVER]: ["readVersion", uintD(1), KN.REQ],

    [EBMLC.MAX_ID_LEN]: ["maxIdLength", uintD(4), KN.REQ],
    [EBMLC.MAX_SZ_LEN]: ["maxSizeLength", uintD(8), KN.REQ],

    [EBMLC.DOCTYPE]: ["doctype", string, KN.REQ],
    [EBMLC.DOCTYPE_VER]: ["doctypeVersion", uintD(1), KN.REQ],
    [EBMLC.DOCTYPE_READVER]: ["doctypeReadVersion", uintD(1), KN.OPT],

    [EBMLC.DOCTYPE_EXT]: ["", ignore, KN.OMUL],
});

export const PARSE_SEEK = master({
    [MKVC.SEEK.ID]: ["id", seekheadId, KN.REQ],
    [MKVC.SEEK.POS]: ["pos", uint, KN.REQ],
});

export const PARSE_SEEKHEAD = master({
    [MKVC.SEEK.MASTER]: ["seeks", PARSE_SEEK, KN.MUL],
});

export const PARSE_EDITION_DISP = master({
    [MKVC.CHAPTERS.EDITION.DISP.LANG]: ["languages", string, KN.OMUL],
    [MKVC.CHAPTERS.EDITION.DISP.STR]: ["string", string, KN.OPT],
});

export const PARSE_CHAPTER_DISPLAY = master({
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.STRING]: ["string", string, KN.REQ],
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.LANGUAGE]: ["language", string, KN.MUL],
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.LANGUAGE_BCP47]: [
        "languagesBcp47",
        string,
        KN.OMUL,
    ],
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.COUNTRY]: ["country", string, KN.OMUL],
});

export const PARSE_CHAPTER = master({
    [MKVC.CHAPTERS.EDITION.CHAPTER.UID]: ["uid", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.CHAPTER.STRID]: ["strid", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.CHAPTER.TIME_START]: ["start", uintD(-1), KN.OPT],
    [MKVC.CHAPTERS.EDITION.CHAPTER.TIME_END]: ["end", uintD(-1), KN.OPT],
    [MKVC.CHAPTERS.EDITION.CHAPTER.HIDDEN]: ["hidden", uintD(1), KN.OPT],
    [MKVC.CHAPTERS.EDITION.CHAPTER.ENABLED]: ["enabled", uintD(1), KN.OPT],
    [MKVC.CHAPTERS.EDITION.CHAPTER.SKIPTYPE]: ["skiptype", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.CHAPTER.PHYS_EQUIV]: [
        "physicalEquivalent",
        uint,
        KN.OPT,
    ],
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.MASTER]: [
        "display",
        PARSE_CHAPTER_DISPLAY,
        KN.OMUL,
    ],
});

export const PARSE_EDITION = master({
    [MKVC.CHAPTERS.EDITION.UID]: ["uid", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.HIDDEN]: ["hidden", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.DEFAULT]: ["default", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.ORDERED]: ["ordered", uint, KN.OPT],

    [MKVC.CHAPTERS.EDITION.DISP.MASTER]: [
        "diplay",
        PARSE_EDITION_DISP,
        KN.OMUL,
    ],

    [MKVC.CHAPTERS.EDITION.CHAPTER.MASTER]: [
        "chapters",
        PARSE_CHAPTER,
        KN.OMUL,
    ],
});

export const PARSE_CHAPTERS = master({
    [MKVC.CHAPTERS.EDITION.MASTER]: ["editions", PARSE_EDITION, KN.MUL],
});

export const PARSE_SEGMENT = master({
    [MKVC.SEEKHEAD]: ["seekheads", PARSE_SEEKHEAD, KN.OMUL],
    [MKVC.CHAPTERS.MASTER]: ["chapters", PARSE_CHAPTERS, KN.OPT],
});
