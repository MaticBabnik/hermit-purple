/** biome-ignore-all lint/complexity/useSimpleNumberKeys: Hex is more readable */

export const MKV_ED_CHAP_TRACK_UID = 0;

export const EBMLC = {
    MAGIC: 0x1a45dfa3,

    VER: 0x0286,
    READVER: 0x02f7,

    MAX_ID_LEN: 0x02f2,
    MAX_SZ_LEN: 0x02f3,

    DOCTYPE: 0x0282,
    DOCTYPE_VER: 0x0287,
    DOCTYPE_READVER: 0x0285,

    DOCTYPE_EXT: 0x0281,

    EXT: {
        NAME: 0x0283,
        VER: 0x0284,
    },
} as const;

export const SEGMENT_CHILD_ID_TO_NAME: Record<number, string> = {
    0x1254c367: "TAG",
    0x1549a966: "INFO",
    0x1c53bb6b: "CUES",
    0x1654ae6b: "TRACKS",
    0x1f43b675: "CLUSTER",
    0x1043a770: "CHAPTERS",
    0x1941a469: "ATTACHMENTS",
} as const;

export const MKVC = {
    MASTER: 0x08538067,

    TAG: 0x0254c367,

    CUES: 0x0c53bb6b,
    TRACKS: 0x0654ae6b,
    CLUSTER: 0x0f43b675,
    SEEKHEAD: 0x014d9b74,
    ATTACHMENTS: 0x0941a469,

    SEEK: {
        MASTER: 0x0dbb,
        ID: 0x13ab,
        POS: 0x13ac,
    },

    INFO: {
        MASTER: 0x0549a966,

        TIMESTAMP_SCALE: 0x0ad7b1,
        DURATION: 0x0489,
    },

    CHAPTERS: {
        MASTER: 0x0043a770,

        EDITION: {
            MASTER: 0x05b9,

            UID: 0x05bc,
            HIDDEN: 0x05bd,
            DEFAULT: 0x05db,
            ORDERED: 0x05dd,

            DISP: {
                MASTER: 0x0520,

                STR: 0x4521,
                LANG: 0x45e4,
            },

            CHAPTER: {
                MASTER: 0x36,

                UID: 0x33c4,
                STRID: 0x1654,
                TIME_START: 0x11,
                TIME_END: 0x12,
                HIDDEN: 0x18,
                ENABLED: 0x0598,
                SEG_UUID: 0x2e67,
                SKIPTYPE: 0x0588,
                SEG_EDIT_UUID: 0x2ebc,

                PHYS_EQUIV: 0x23c3,

                TRACK: {
                    MASTER: 0x0f,

                    UID: 0x09,
                },

                DISP: {
                    MASTER: 0x00,

                    STRING: 0x05,
                    LANGUAGE: 0x037c,
                    LANGUAGE_BCP47: 0x037d,
                    COUNTRY: 0x037e,
                },

                // TBH we don't give a fuck :)
                PROCESS: 0x2944,
            },
        },
    },
} as const;
