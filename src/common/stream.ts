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
        if (pos < 0 && pos >= this.dv.byteLength)
            throw new StreamError("OOB", this.offset);

        this.offset = pos;
    }

    skip(offset: number) {
        this.seek(this.offset + offset);
    }

    private assertRead(size: number) {
        if (this.offset + size > this.dv.byteLength)
            throw new StreamError("End of buffer reached", this.offset);
    }

    public readU8(): number {
        this.assertRead(1);
        return this.dv.getUint8(this.offset++);
    }

    public readU16(): number {
        this.assertRead(2);
        const v = this.dv.getUint16(this.offset);
        this.offset += 2;
        return v;
    }

    public readU24(): number {
        this.assertRead(2);
        let v = this.dv.getUint16(this.offset) << 8;
        this.offset += 2;
        v |= this.dv.getUint8(this.offset++);
        return v;
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

    public readStrPU16() {
        return this.readStr(this.readU16());
    }

    private readVintHeader() {
        const x = this.readU8();
        this.offset--;

        for (let i = 0; i < 8; i++) {
            if (x & (0x80 >> i)) return i + 1;
        }

        throw new StreamError("VINT too big", this.offset);
    }

    public readVLIU32() {
        const n = this.readVintHeader();
        switch (n) {
            case 1:
                return this.readU8() & 0x7f;
            case 2:
                return this.readU16() & 0x3f_ff;
            case 3:
                return this.readU24() & 0x1f_ff_ff;
            case 4:
                return this.readU32() & 0x0f_ff_ff_ff;
            case 8: {
                const n = this.readU64() & 0xff_ffff_ffff_ffffn;
                const n32 = n & 0xffff_ffffn;
                if (n32 !== n) {
                    throw new StreamError(
                        `Can't cast U64(${n}) to U32`,
                        this.offset
                    );
                }
                return Number(n);
            }
            default:
                throw new StreamError(
                    `Can't read vint(${n}) as I32`,
                    this.offset
                );
        }
    }

    public readVLII32() {
        const n = this.readVintHeader();
        switch (n) {
            case 1:
                return ((this.readU8() & 0x7f) << 25) >> 25;
            case 2:
                return ((this.readU16() & 0x3f_ff) << 18) >> 18;
            case 3:
                return ((this.readU24() & 0x1f_ff_ff) << 11) >> 11;
            case 4:
                return ((this.readU32() & 0x0f_ff_ff_ff) << 4) >> 4;
            default:
                throw new StreamError(
                    `Can't read vint(${n}) as I32`,
                    this.offset
                );
        }
    }

    public readVLIBU() {
        return 0;
    }

    public readVLIBS() {
        return 0;
    }
}

export class StreamError extends Error {
    public constructor(what: string, public readonly at: number) {
        super(what);
    }
}
