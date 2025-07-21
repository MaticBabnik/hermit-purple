/** biome-ignore-all lint/suspicious/noConsole: Error logging */

import { RedisClient } from "bun";
import {
    getTitleInPreferedLanguage,
    HttpMediaFile,
    LIB_INFO,
    type IChapterParser,
} from "../lib/common";
import { getParserForMime } from "../lib/parsers";
import { toWebVtt } from "../lib/webvtt";

type ChapterResult = {
    code: number;
    mime: string;
    result: string;
    timestamp: number;
};

const HOUR = 3600;

export class MediaChapters {
    private _promiseCache = new Map<string, Promise<ChapterResult>>();
    private _redis = new RedisClient();

    public async init() {
        const v = await this._redis.get("_version");

        if (v !== LIB_INFO) {
            console.log("VERSION MISMATCH!!!\n\tFLUSHING DB\n")
            await this._redis.send("FLUSHDB", ["SYNC"]); // mimiimmimimiim
        }

        await this._redis.set("_version", LIB_INFO);
    }

    public async getForUrl(
        url: string,
        forceNew: boolean = false
    ): Promise<ChapterResult> {
        const existingPromise = this._promiseCache.get(url);

        if (existingPromise) {
            return await existingPromise;
        }

        if (!forceNew) {
            const fromRedis = await this._redis.get(url);
            if (fromRedis !== null) return JSON.parse(fromRedis);
        }

        // biome-ignore lint/suspicious/noAsyncPromiseExecutor: no callback hell
        const p = new Promise<ChapterResult>(async (res) => {
            const r = await this.processFile(url);

            try {
                await this._redis.set(url, JSON.stringify(r));
                await this._redis.expire(
                    url,
                    r.code === 200 ? 24 * HOUR : HOUR
                );
            } catch (e) {
                console.error("Failed to store in redis", e);
            }

            this._promiseCache.delete(url);

            res(r);
        });
        this._promiseCache.set(url, p);

        return await p;
    }

    private async processFile(url: string): Promise<ChapterResult> {
        const start = Date.now();

        const file = new HttpMediaFile(url);
        let parser: IChapterParser | undefined;

        try {
            const mime = await file.getMime();
            const ParserCtor = getParserForMime(mime);

            if (!ParserCtor) {
                throw new Error("Unsupported mime");
            }

            parser = new ParserCtor(await file.getView(0, 1_234_567, false));

            const result = parser.parseChapters() ?? {
                duration: 0,
                chapters: [],
            };

            const chapterCues = result.chapters.map((x) => ({
                ...x,
                title: getTitleInPreferedLanguage(x.title),
            }));

            const vtt = toWebVtt(chapterCues, result.duration, [
                file.identifier,
                ...parser.getQuirks(),
            ]);

            const end = Date.now();

            console.log(
                `Parsed ${chapterCues.length} chapters from "${url}" in ${end - start}ms`
            );

            return {
                code: 200,
                mime: "text/vtt",
                result: vtt,
                timestamp: end,
            };
        } catch (e) {
            const end = Date.now();

            console.error(
                `Failed to parse chapters from "${url}" in ${end - start}ms`
            );

            return {
                code: 500,
                mime: "application/json",
                result: JSON.stringify({
                    error: e instanceof Error ? e.message : "unknown",
                    quirks: parser?.getQuirks() ?? [],
                }),
                timestamp: end,
            };
        }
    }
}
