export interface BoxHeader {
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

export interface FullBoxHeader extends BoxHeader {
    version: number;
    flags: number;
}

export interface MvhdData {
    duration: bigint;
    timescale: number;
    rate: number;
}

export interface Ftyp {
    box: BoxHeader;
    major: string;
    minor: number;
    brands: string[];
}

export type SttsEntries = [number, number][];
export type StscEntries = [number, number, number][];
export type StszEntries = number[] & { default: number };
export type StcoEntries = number[];

export interface Samples {
    stts: SttsEntries;
    stsc: StscEntries;
    stsz: StszEntries;
    stco: StcoEntries;
}
