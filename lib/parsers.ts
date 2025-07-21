import type { IChapterParser } from "./common";
import { ISOBMFParser } from "./isobmf";
import { MatroskaParser } from "./matroska";

interface IChapterParserConstructor {
    new (initialBuf: ArrayBuffer): IChapterParser;
}

const MIME_MAP: Record<string, IChapterParserConstructor> = {
    "video/mp4": ISOBMFParser,
    "video/mpeg": ISOBMFParser,
    "video/x-m4v": ISOBMFParser,

    "video/webm": MatroskaParser,
    "video/x-matroska": MatroskaParser,
};

export function getParserForMime(
    mime: string
): IChapterParserConstructor | undefined {
    return MIME_MAP[mime];
}
