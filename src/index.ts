/** biome-ignore-all lint/suspicious/noConsole: Logging */

import { env } from "bun";
import Elysia, { t } from "elysia";
import { LIB_INFO } from "../lib/common";
import { MediaChapters } from "./media-chapters";

const port = parseInt(env.PORT ?? "");

const mediaChapters = new MediaChapters();

const _app = new Elysia()
    .get(
        "/chapters",
        async ({ query: { url } }) => {
            const r = await mediaChapters.getForUrl(url);

            return new Response(r.result, {
                headers: {
                    "Content-Type": r.mime,
                    Age: ((Date.now() - r.timestamp) / 1000).toFixed(0),
                },
                status: r.code,
            });
        },
        {
            query: t.Object({
                url: t.String({
                    format: "url",
                    error: "Invalid URL format",
                }),
            }),
        }
    )
    .listen(Number.isNaN(port) ? 3000 : port, (server) => {
        console.log(
            `Hermit purple server\n\t${LIB_INFO}\n\tListening on ${server.port}\n`
        );
    });

await mediaChapters.init();
