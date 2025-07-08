export function assert<T>(cond: T, msg?: string): asserts cond {
    if (!cond) throw new Error(`AssertionError: ${msg ?? "?"}`);
}

/**
 * Not null/undefined assertion
 */
export function nn<T>(value: T | null | undefined, message?: string): T {
    if (value === null) throw new Error(message ?? "value was null");
    if (value === undefined) throw new Error(message ?? "value was undefined");
    return value;
}

/**
 * Assert alignment 32
 * @param n
 */
export function aa32(n: number, what?: string) {
    assert(
        (n & 0x7) === 0,
        `0x${n.toString(16)} is not aligned to 8 bytes (${what ?? "?"})`
    );
}

/**
 * Assert alignment 64
 * @param n
 * @param what
 */
export function aa64(n: number, what?: string) {
    assert(
        (n & 0x7) === 0,
        `0x${n.toString(16)} is not aligned to 8 bytes (${what ?? "?"})`
    );
}