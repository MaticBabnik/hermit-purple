/** biome-ignore-all lint/performance/noReExportAll: convenience */
/** biome-ignore-all lint/performance/noBarrelFile: convenience */

import { name, version } from "../../package.json";
import type { Title } from "./parser";

/**
 * Assert alignment 32
 */
export function aa32(n: number, what?: string) {
    assert(
        (n & 0x7) === 0,
        `0x${n.toString(16)} is not aligned to 8 bytes (${what ?? "?"})`
    );
}

/**
 * Assert alignment 64
 */
export function aa64(n: number, what?: string) {
    assert(
        (n & 0x7) === 0,
        `0x${n.toString(16)} is not aligned to 8 bytes (${what ?? "?"})`
    );
}

/**
 * Asserts `cond`
 */
export function assert<T>(cond: T, msg?: string): asserts cond {
    if (!cond) throw new Error(`AssertionError: ${msg ?? "?"}`);
}

export function getTitleInPreferedLanguage(titles: Title[], lang = "eng") {
    return (
        (titles.find((x) => x.lang === lang) ?? titles.at(0))?.text ?? "Chapter"
    );
}

/**
 * Not null/undefined assertion
 */
export function nn<T>(value: T | undefined | null, message?: string): T {
    if (value === null) throw new Error(message ?? "value was null");
    if (value === undefined) throw new Error(message ?? "value was undefined");
    return value;
}

export const LIB_INFO = `${name}@${version}`;

export * from "./file";
export * from "./parser";
export * from "./stream";
