import { EBMLC, MKVC } from "./constants";
import {
    float,
    ignore,
    KN,
    master,
    seekheadId,
    string,
    uint,
    uintD,
} from "./ebml";

export function timestampToSeconds(
    elementValue: number,
    timestampScale: number
): number {
    const timestampNanoseconds = elementValue * timestampScale;
    const seconds = timestampNanoseconds / 1_000_000_000;
    return seconds;
}

export const headParser = master({
    [EBMLC.VER]: ["version", uintD(1), KN.REQ],
    [EBMLC.READVER]: ["readVersion", uintD(1), KN.REQ],

    [EBMLC.MAX_ID_LEN]: ["maxIdLength", uintD(4), KN.REQ],
    [EBMLC.MAX_SZ_LEN]: ["maxSizeLength", uintD(8), KN.REQ],

    [EBMLC.DOCTYPE]: ["doctype", string, KN.REQ],
    [EBMLC.DOCTYPE_VER]: ["doctypeVersion", uintD(1), KN.REQ],
    [EBMLC.DOCTYPE_READVER]: ["doctypeReadVersion", uintD(1), KN.OPT],

    [EBMLC.DOCTYPE_EXT]: ["", ignore, KN.OMUL],
});

export const seekParser = master({
    [MKVC.SEEK.ID]: ["id", seekheadId, KN.REQ],
    [MKVC.SEEK.POS]: ["pos", uint, KN.REQ],
});

export const seekheadParser = master({
    [MKVC.SEEK.MASTER]: ["seeks", seekParser, KN.MUL],
});

export const editionDisplayParser = master({
    [MKVC.CHAPTERS.EDITION.DISP.LANG]: ["languages", string, KN.OMUL],
    [MKVC.CHAPTERS.EDITION.DISP.STR]: ["string", string, KN.OPT],
});

export const chapterDisplayParser = master({
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.STRING]: ["string", string, KN.REQ],
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.LANGUAGE]: [
        "languages",
        string,
        KN.OMUL,
    ],
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.LANGUAGE_BCP47]: [
        "languagesBcp47",
        string,
        KN.OMUL,
    ],
    [MKVC.CHAPTERS.EDITION.CHAPTER.DISP.COUNTRY]: [
        "countries",
        string,
        KN.OMUL,
    ],
});

export const chapterParser = master({
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
        chapterDisplayParser,
        KN.OMUL,
    ],
});

export const editionParser = master({
    [MKVC.CHAPTERS.EDITION.UID]: ["uid", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.HIDDEN]: ["hidden", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.DEFAULT]: ["default", uint, KN.OPT],
    [MKVC.CHAPTERS.EDITION.ORDERED]: ["ordered", uint, KN.OPT],

    [MKVC.CHAPTERS.EDITION.DISP.MASTER]: [
        "display",
        editionDisplayParser,
        KN.OMUL,
    ],

    [MKVC.CHAPTERS.EDITION.CHAPTER.MASTER]: [
        "chapters",
        chapterParser,
        KN.OMUL,
    ],
});

export const chaptersParser = master({
    [MKVC.CHAPTERS.EDITION.MASTER]: ["editions", editionParser, KN.MUL],
});

export const infoParser = master({
    [MKVC.INFO.DURATION]: ["duration", float, KN.REQ],
    [MKVC.INFO.TIMESTAMP_SCALE]: ["timestampScale", uintD(1000000), KN.REQ],
});

export const segmentParser = master({
    [MKVC.SEEKHEAD]: ["seekheads", seekheadParser, KN.OMUL],
    [MKVC.CHAPTERS.MASTER]: ["chapters", chaptersParser, KN.OPT],
    [MKVC.INFO.MASTER]: ["info", infoParser, KN.REQ],
});
