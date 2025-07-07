export interface IAsyncMediaFile {
    get identifier(): string;

    getTotalSize(): Promise<number>;

    getMime(): Promise<string>;

    getView(
        offset: number,
        size: number,
        requireAll?: boolean
    ): Promise<ArrayBuffer>;
}

export class LocalFSMediaFile implements IAsyncMediaFile {
    protected file: Bun.BunFile;

    constructor(protected path: string) {
        this.file = Bun.file(path);
    }

    get identifier(): string {
        return this.path;
    }

    // biome-ignore lint/suspicious/useAwait: Interface is async
    async getTotalSize(): Promise<number> {
        return this.file.size;
    }

    // biome-ignore lint/suspicious/useAwait: Interface is async
    async getMime(): Promise<string> {
        return this.file.type;
    }

    async getView(offset: number, size: number, requireAll = false) {
        void requireAll;
        return await this.file.slice(offset, offset + size).arrayBuffer();
    }
}

type MediaMetaHeaders = {
    size: number;
    contentType: string;
};

export class HttpMediaFile implements IAsyncMediaFile {
    constructor(protected url: string) {}

    private metaCache: undefined | MediaMetaHeaders | Promise<MediaMetaHeaders>;

    get identifier(): string {
        return this.url;
    }

    private async getHeaders(): Promise<MediaMetaHeaders> {
        const res = await fetch(this.url, {
            method: "HEAD",
        });

        const contentLength = res.headers.get("content-length");
        const contentType = res.headers.get("content-type");

        if (typeof contentLength !== "string")
            throw new Error("No content-length");

        if (typeof contentType !== "string") throw new Error("No content-type");

        const size = parseInt(contentLength);

        if (Number.isNaN(size)) throw new Error("Bad content-length");

        return { size, contentType };
    }

    private async getCachedHeaders() {
        if (this.metaCache instanceof Promise) {
            return await this.metaCache;
        } else if (this.metaCache !== undefined) {
            return this.metaCache;
        }

        const p = this.getHeaders();
        this.metaCache = p;
        this.metaCache = await p;
        return this.metaCache;
    }

    async getTotalSize(): Promise<number> {
        return (await this.getCachedHeaders()).size;
    }

    async getMime(): Promise<string> {
        return (await this.getCachedHeaders()).contentType;
    }

    async getView(
        offset: number,
        size: number,
        requireAll = false
    ): Promise<ArrayBuffer> {
        // TODO(mbabnik): impl?
        void requireAll;

        const res = await fetch(this.url, {
            method: "GET",
            headers: {
                Range: `bytes=${offset}-${offset + size - 1}`,
            },
        });

        return await res.arrayBuffer();
    }
}
