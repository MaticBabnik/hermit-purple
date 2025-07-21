/**
 * Language + string pair
 */
export type Title = {
    /**
     * Language, defaults to "unk"
     */
    lang: string;

    /**
     * Actual title
     */
    text: string;
};

/**
 * Chapter entry
 */
export type Chapter = {
    /**
     * Chapter start time (in seconds)
     */
    start: number;

    /**
     * Chapter end time (optional) (in seconds)
     */
    end?: number;

    /**
     * Array of titles
     */
    title: Title[];
};

/**
 * Chapter cue for WebVTT
 */
export type ChapterCue = {
    /**
     * Chapter start time (in seconds)
     */
    start: number;

    /**
     * Chapter end time (optional) (in seconds)
     */
    end?: number;

    /**
     * Array of titles
     */
    title: string;
};

export type ChapterInfo = {
    /**
     * Chapters from the default edition (if container supports multiple editions)
     */
    chapters: Chapter[];

    /**
     * File duration in seconds
     */
    duration: number;
};

export interface IChapterParser {
    /**
     * - Validates the container
     * - Scans for chapters & header
     * - parses them
     *
     * @throws If file is malformed/runs out of data
     * @returns undefined if no chapter data in file
     */
    parseChapters(): ChapterInfo | undefined;

    /**
     * Returns metadata, errors and or warnings that were encountered when parsing
     */
    getQuirks(): string[];
}
