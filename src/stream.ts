export class StreamReader {
    private static td = new TextDecoder("utf-8", { fatal: false });

    constructor(
        private dv: DataView<ArrayBuffer>,
        private offset = 0
    ) {}

    public get position() {
        return this.offset;
    }

    seek(pos: number) {
        if (pos < 0 && pos >= this.dv.byteLength) throw new Error("OOB");

        this.offset = pos;
    }

    skip(offset: number) {
        this.seek(this.offset + offset);
    }

    private assertRead(size: number) {
        if (this.offset + size > this.dv.byteLength)
            throw new Error("End of buffer reached");
    }

    public readU8(): number {
        this.assertRead(1);
        return this.dv.getUint8(this.offset++);
    }

    public readU32(): number {
        this.assertRead(4);
        const v = this.dv.getUint32(this.offset);
        this.offset += 4;
        return v;
    }

    public readI32(): number {
        this.assertRead(4);
        const v = this.dv.getInt32(this.offset);
        this.offset += 4;
        return v;
    }

    public readFixed32() {
        const v = this.readI32();
        return v / 0x10000;
    }

    public readU64(): bigint {
        this.assertRead(8);
        const v = this.dv.getBigUint64(this.offset);
        this.offset += 8;
        return v;
    }

    public readStr(n: number) {
        this.assertRead(n);

        const str = StreamReader.td.decode(
            this.dv.buffer.slice(this.offset, this.offset + n)
        );
        this.offset += n;

        return str;
    }

    public readStrPU8() {
        return this.readStr(this.readU8());
    }
}
