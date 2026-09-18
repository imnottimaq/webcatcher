import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useBeatmap } from "../contexts/beatmapContextValue";
import {
    getImportedBeatmapFile,
    getBeatmapBackgroundPath,
    type BeatmapDifficulty,
} from "../files/beatmap/beatmapImporter";
import { loadGameplayAudio, type GameplayAudioClock } from "./audioClock";
import { prepareCatchBeatmap } from "./catchObjects";
import GameCanvas from "./GameCanvas";
import { INITIAL_GAMEPLAY_STATS, type GameplayStats } from "./gameplayStats";
import PlayerLoader from "./PlayerLoader";
import { DEFAULT_SETTINGS, type SettingsState } from "./settingsTypes";

type SessionPhase =
    | "loading"
    | "ready"
    | "starting"
    | "playing"
    | "failed"
    | "cleared"
    | "error";

interface GameplaySessionProps {
    setId: string;
    difficulty: BeatmapDifficulty;
    onExit(): void;
    onRetry(): void;
}

interface GameplayProps {
    onExit(): void;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown gameplay error";
}

function GameplaySession({
    setId,
    difficulty,
    onExit,
    onRetry,
}: GameplaySessionProps) {
    const preparedBeatmap = useMemo(
        () => prepareCatchBeatmap(difficulty.parsed),
        [difficulty.parsed],
    );
    const audioRef = useRef<GameplayAudioClock>(undefined);
    const mountedRef = useRef(true);
    const [audioDurationMs, setAudioDurationMs] = useState<number>();
    const [backgroundUrl, setBackgroundUrl] = useState<string>();
    const [phase, setPhase] = useState<SessionPhase>("loading");
    const [errorMessage, setErrorMessage] = useState<string>();
    const [stats, setStats] = useState<GameplayStats>({
        ...INITIAL_GAMEPLAY_STATS,
    });
    const [settings, setSettings] = useState<SettingsState>(() => {
        try {
            const saved = localStorage.getItem("webcatcher_settings");
            if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch {
            // ignore
        }
        return DEFAULT_SETTINGS;
    });

    const handleSettingChange = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setSettings((prev) => {
            const updated = { ...prev, [key]: value };
            try {
                localStorage.setItem("webcatcher_settings", JSON.stringify(updated));
            } catch {
                // ignore
            }
            return updated;
        });
    }, []);

    const handleSettingReset = useCallback(<K extends keyof SettingsState>(key: K) => {
        setSettings((prev) => {
            const updated = { ...prev, [key]: DEFAULT_SETTINGS[key] };
            try {
                localStorage.setItem("webcatcher_settings", JSON.stringify(updated));
            } catch {
                // ignore
            }
            return updated;
        });
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const abortController = new AbortController();
        let loadedAudio: GameplayAudioClock | undefined;
        let createdBgUrl: string | undefined;

        void (async () => {
            try {
                const audioFilename = difficulty.parsed.general.audioFilename;

                if (!audioFilename) {
                    throw new Error("This difficulty does not specify an audio file");
                }

                const file = await getImportedBeatmapFile(
                    setId,
                    difficulty.path,
                    audioFilename,
                );

                if (abortController.signal.aborted) return;

                loadedAudio = await loadGameplayAudio(file, abortController.signal);

                if (abortController.signal.aborted) {
                    loadedAudio.destroy();
                    return;
                }

                audioRef.current = loadedAudio;
                setAudioDurationMs(loadedAudio.durationMs);

                const bgFilename = getBeatmapBackgroundPath(difficulty.parsed);
                if (bgFilename) {
                    try {
                        const bgFile = await getImportedBeatmapFile(
                            setId,
                            difficulty.path,
                            bgFilename,
                        );
                        if (!abortController.signal.aborted) {
                            createdBgUrl = URL.createObjectURL(bgFile);
                            setBackgroundUrl(createdBgUrl);
                        }
                    } catch (bgError) {
                        console.warn("Failed to load beatmap background:", bgError);
                    }
                }
            } catch (error) {
                if (
                    abortController.signal.aborted
                    || error instanceof DOMException && error.name === "AbortError"
                ) {
                    return;
                }

                console.error("Failed to load gameplay audio", error);
                setErrorMessage(getErrorMessage(error));
                setPhase("error");
            }
        })();

        return () => {
            abortController.abort();
            loadedAudio?.destroy();
            if (audioRef.current === loadedAudio) audioRef.current = undefined;
            if (createdBgUrl) {
                URL.revokeObjectURL(createdBgUrl);
            }
        };
    }, [difficulty.parsed, difficulty.path, setId]);

    const getMapTime = useCallback(
        () => audioRef.current?.getTime() ?? Number.NEGATIVE_INFINITY,
        [],
    );
    const handleError = useCallback((error: unknown) => {
        if (!mountedRef.current) return;

        console.error("Gameplay failed", error);
        audioRef.current?.destroy();
        setErrorMessage(getErrorMessage(error));
        setPhase("error");
    }, []);
    const handleGameReady = useCallback(() => {
        setPhase((current) => current === "loading" ? "ready" : current);
    }, []);
    const handleFailed = useCallback(() => {
        audioRef.current?.destroy();
        setPhase("failed");
    }, []);
    const handleCleared = useCallback(() => {
        audioRef.current?.destroy();
        setPhase("cleared");
    }, []);

    async function handleStart(): Promise<void> {
        const audio = audioRef.current;
        if (phase !== "ready" || !audio) return;

        setPhase("starting");

        try {
            await audio.start(preparedBeatmap.preRollMs);
            if (mountedRef.current) setPhase("playing");
        } catch (error) {
            if (mountedRef.current) handleError(error);
        }
    }

    const isPlaying = phase === "playing";

    return (
        <main className="game-page">
            {audioDurationMs !== undefined && (
                <GameCanvas
                    beatmap={difficulty.parsed}
                    preparedBeatmap={preparedBeatmap}
                    audioDurationMs={audioDurationMs}
                    backgroundUrl={backgroundUrl}
                    backgroundDim={settings.backgroundDim}
                    isPlaying={isPlaying}
                    getMapTime={getMapTime}
                    onStatsChange={setStats}
                    onReady={handleGameReady}
                    onError={handleError}
                    onFailed={handleFailed}
                    onCleared={handleCleared}
                />
            )}

            {(phase === "loading" || phase === "ready" || phase === "starting") && (
                <PlayerLoader
                    difficulty={difficulty}
                    backgroundUrl={backgroundUrl}
                    isReady={phase === "ready"}
                    settings={settings}
                    onSettingsChange={handleSettingChange}
                    onSettingsReset={handleSettingReset}
                    onStart={() => void handleStart()}
                    onBack={onExit}
                />
            )}

            {(phase === "failed" || phase === "cleared" || phase === "error") && (
                <div className="game-overlay" role="status">
                    <div className="game-dialog">
                        {phase === "failed" && (
                            <>
                                <h1>Failed</h1>
                                <button onClick={onRetry}>Retry</button>
                            </>
                        )}
                        {phase === "cleared" && (
                            <>
                                <h1>Map cleared</h1>
                                <p>Score: {stats.score.toLocaleString()}</p>
                                <button onClick={onRetry}>Replay</button>
                            </>
                        )}
                        {phase === "error" && (
                            <>
                                <h1>Could not start gameplay</h1>
                                <p>{errorMessage}</p>
                                <button onClick={onRetry}>Retry</button>
                            </>
                        )}
                        <button className="game-back" onClick={onExit}>Back</button>
                    </div>
                </div>
            )}
        </main>
    );
}

export default function Gameplay({ onExit }: GameplayProps) {
    const { selectedSet, selectedDifficulty } = useBeatmap();
    const [attempt, setAttempt] = useState(0);
    const handleRetry = useCallback(() => {
        setAttempt((current) => current + 1);
    }, []);

    if (!selectedSet || !selectedDifficulty) {
        return (
            <main className="game-page">
                <div className="game-overlay">
                    <div className="game-dialog">
                        <h1>No difficulty selected</h1>
                        <button onClick={onExit}>Back</button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <GameplaySession
            key={`${selectedDifficulty.id}:${attempt}`}
            setId={selectedSet.id}
            difficulty={selectedDifficulty}
            onExit={onExit}
            onRetry={handleRetry}
        />
    );
}
