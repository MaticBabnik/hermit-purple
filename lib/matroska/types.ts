export interface EBMLHead {
    version: number;
    readVersion: number;
    maxIdLength: number;
    maxSizeLength: number;
    doctype: string;
    doctypeVersion: number;
    doctypeReadVersion?: number;
}

export interface SeekHeads {
    seeks: {
        id:
            | "TAG"
            | "INFO"
            | "CUES"
            | "TRACKS"
            | "CLUSTER"
            | "CHAPTERS"
            | "ATTACHMENTS"
            | `unk-${string}`;
        pos: number;
    }[];
}

export interface Info {
    timestampScale: number;
    duration: number;
}

export interface EditionDisplay {
    string: string;
    languages: string[];
}

export interface ChapterDisplay {
    string: string;
    languages?: string[];
    languagesBcp47?: string[];
    countries?: string[];
}

export interface Chapter {
    uid: number;
    strid?: string;

    start: number;
    end: number;

    hidden?: number;
    enabled?: number;
    skiptype?: number;
    physicalEquivalent?: number;

    display: ChapterDisplay[];
}

export interface Edition {
    uid?: number;

    hidden?: number;
    default?: number;
    ordered?: number;

    display?: EditionDisplay[];

    chapters: Chapter[];
}

export interface Chapters {
    editions: Edition[];
}

export interface Segment {
    info: Info;
    seekheads?: SeekHeads[];
    chapters?: Chapters;
}
