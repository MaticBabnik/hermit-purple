import type { ChapterCue } from "./common";

interface CompleteChapter {
    start: number;
    end: number;
    title: string;
}

const vttEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
    "\r": "\\r",
    "\n": "\\n",
};

function escapeWebVTT(text: string) {
    return text.replace(/[&<>"']/g, (c) => vttEscapeMap[c] ?? "");
}

function timestamp(time: number) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor(time / 60) % 60;
    const seconds = time - (hours * 60 + minutes) * 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toFixed(3).padStart(6, "0")}`;
}

function makeVttEvent(index: number, chapter: CompleteChapter) {
    return `${index}\n${timestamp(chapter.start)} --> ${timestamp(chapter.end)}\n${escapeWebVTT(chapter.title)}\n`;
}

export function toWebVtt(
    chapters: ChapterCue[],
    duration: number,
    notes: string[]
) {
    const file = [
        "WEBVTT\n",
        ...notes.map((x) => `NOTE ${escapeWebVTT(x)}`),
        "",
    ];

    for (let i = 0; i < chapters.length; i++) {
        // biome-ignore lint/style/noNonNullAssertion: contiguous array accessed by i < length
        const c = chapters[i]!;

        file.push(
            makeVttEvent(i + 1, {
                start: c.start,
                end: c.end ?? chapters[i + 1]?.start ?? duration,
                title: c.title,
            })
        );
    }

    return file.join("\n");
}
