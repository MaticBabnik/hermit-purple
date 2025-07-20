/** biome-ignore-all lint/performance/noReExportAll: convenience */
/** biome-ignore-all lint/performance/noBarrelFile: convenience */

/**
 * Asserts `cond`
 */
export function assert<T>(cond: T, msg?: string): asserts cond {
    if (!cond) throw new Error(`AssertionError: ${msg ?? "?"}`);
}

/**
 * Not null/undefined assertion
 */
export function nn<T>(
    value: T | undefined | null,
    message?: string
): T {
    if (value === null) throw new Error(message ?? "value was null");
    if (value === undefined) throw new Error(message ?? "value was undefined");
    return value;
}

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

export * from "./file";
export * from "./stream";
