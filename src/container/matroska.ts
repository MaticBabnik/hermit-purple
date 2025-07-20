import { assert, StreamReader } from "../common";
import { HEAD_PARSER, PARSE_SEGMENT, type EBMLHead } from "../dec/ebml";
import { MKVC, EBMLC } from "../mkvconst";

export class MatroskaParser {
    protected static td = new TextDecoder("utf-8", { fatal: false });
    protected view: DataView<ArrayBuffer>;
    protected reader: StreamReader;
    protected quirks = new Set<string>();

    constructor(protected initialBuf: ArrayBuffer) {
        this.view = new DataView(initialBuf);
        this.reader = new StreamReader(this.view);
    }

    public readHeader() {
        assert(this.reader.readU32() === EBMLC.MAGIC, "File isn't EBML");
        const header = HEAD_PARSER(this.reader) as unknown as EBMLHead;

        assert(
            header.doctype === "matroska" || header.doctype === "webm",
            "File isn't Matroska/WebM"
        );

        assert(header.maxIdLength === 4, "Unsupported max length");

        return header;
    }

    public readSegment() {
        assert(this.reader.readVLIU32() === MKVC.MASTER, "Not a segment");

        return PARSE_SEGMENT(this.reader);
    }
}
