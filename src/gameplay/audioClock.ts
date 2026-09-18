export interface GameplayAudioClock {
    readonly durationMs: number;
    start(preRollMs: number): Promise<void>;
    getTime(): number;
    destroy(): void;
}

function createAbortError(): DOMException {
    return new DOMException("Audio loading was cancelled", "AbortError");
}

export async function loadGameplayAudio(
    file: File,
    signal?: AbortSignal,
): Promise<GameplayAudioClock> {
    const context = new AudioContext({ latencyHint: "interactive" });

    try {
        const encodedAudio = await file.arrayBuffer();
        if (signal?.aborted) throw createAbortError();

        const buffer = await context.decodeAudioData(encodedAudio);
        if (signal?.aborted) throw createAbortError();

        let source: AudioBufferSourceNode | undefined;
        let mapZeroContextTime: number | undefined;
        let startPromise: Promise<void> | undefined;
        let destroyed = false;

        return {
            durationMs: buffer.duration * 1_000,
            start(preRollMs: number): Promise<void> {
                if (destroyed) return Promise.reject(new Error("Gameplay audio has been destroyed"));
                if (startPromise) return startPromise;

                startPromise = (async () => {
                    await context.resume();

                    if (destroyed) throw new Error("Gameplay audio has been destroyed");
                    if (context.state !== "running") throw new Error("Browser did not allow audio playback");

                    const nextSource = context.createBufferSource();
                    nextSource.buffer = buffer;
                    nextSource.connect(context.destination);

                    const safePreRoll = Number.isFinite(preRollMs)
                        ? Math.max(0, preRollMs)
                        : 0;
                    const nextMapZero = context.currentTime + safePreRoll / 1_000;

                    try {
                        nextSource.start(nextMapZero);
                    } catch (error) {
                        nextSource.disconnect();
                        throw error;
                    }

                    source = nextSource;
                    mapZeroContextTime = nextMapZero;

                    nextSource.addEventListener("ended", () => {
                        nextSource.disconnect();
                        if (source === nextSource) source = undefined;
                    }, { once: true });
                })();

                return startPromise;
            },
            getTime(): number {
                if (mapZeroContextTime === undefined) return Number.NEGATIVE_INFINITY;

                return (context.currentTime - mapZeroContextTime) * 1_000;
            },
            destroy(): void {
                if (destroyed) return;
                destroyed = true;

                if (source) {
                    try {
                        source.stop();
                    } catch {
                        // The source may already have ended.
                    }
                    source.disconnect();
                    source = undefined;
                }

                void context.close().catch(() => undefined);
            },
        };
    } catch (error) {
        void context.close().catch(() => undefined);
        throw error;
    }
}
