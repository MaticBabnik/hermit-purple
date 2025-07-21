import { StreamError, type StreamReader } from "../common";
import { SEGMENT_CHILD_ID_TO_NAME } from "./constants";

export type ParserFun = (sr: StreamReader, id: number) => unknown;

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
    const x = r.readVLIU32_overflowOk();
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
        const size = sr.readVLIU32_overflowOk();
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

export function floatD(defaultValue = 0) {
    return (r: StreamReader) => {
        const x = r.readVLIU32();

        switch (x) {
            case 0:
                return defaultValue;
            case 4:
                return r.readF32();
            case 8:
                return r.readF64();
            default:
                throw new Error(`Invalid float size: ${x}`);
        }
    };
}

export const float = floatD(0);
