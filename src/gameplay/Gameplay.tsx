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
import RankingScreen from "./RankingScreen";
import PauseOverlay from "./PauseOverlay";
import FailOverlay from "./FailOverlay";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type SettingsState } from "./settingsTypes";
import { incrementPlayCount } from "./localScores";

type SessionPhase =
    | "loading"
    | "ready"
    | "starting"
    | "playing"
    | "paused"
    | "failed"
    | "cleared"
    | "error";

interface GameplaySessionProps {
    setId: string;
    difficulty: BeatmapDifficulty;
    retryCount?: number;
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
    retryCount = 0,
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
    const [audioContext, setAudioContext] = useState<AudioContext>();
    const [backgroundUrl, setBackgroundUrl] = useState<string>();
    const [phase, setPhase] = useState<SessionPhase>("loading");
    const [errorMessage, setErrorMessage] = useState<string>();
    const statsRef = useRef<GameplayStats>({ ...INITIAL_GAMEPLAY_STATS });
    const [finalStats, setFinalStats] = useState<GameplayStats>({
        ...INITIAL_GAMEPLAY_STATS,
    });
    const [pausedMapTime, setPausedMapTime] = useState(0);
    const [settings, setSettings] = useState<SettingsState>(() => loadSettings());

    const handleSettingChange = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setSettings((prev) => {
            const updated = { ...prev, [key]: value };
            saveSettings(updated);
            return updated;
        });
    }, []);

    const handleSettingReset = useCallback(<K extends keyof SettingsState>(key: K) => {
        setSettings((prev) => {
            const updated = { ...prev, [key]: DEFAULT_SETTINGS[key] };
            saveSettings(updated);
            return updated;
        });
    }, []);

    const settingsRef = useRef(settings);
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

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
                        }
                    } catch (bgError) {
                        console.warn("Failed to load beatmap background:", bgError);
                    }
                }

                if (abortController.signal.aborted) {
                    loadedAudio.destroy();
                    if (createdBgUrl) URL.revokeObjectURL(createdBgUrl);
                    return;
                }

                audioRef.current = loadedAudio;
                if (createdBgUrl) setBackgroundUrl(createdBgUrl);
                setAudioContext(loadedAudio.context);
                setAudioDurationMs(loadedAudio.durationMs);
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
            setAudioContext(undefined);
            if (createdBgUrl) {
                URL.revokeObjectURL(createdBgUrl);
            }
        };
    }, [difficulty.parsed, difficulty.path, setId]);

    const getMapTime = useCallback(
        () => {
            const time = audioRef.current?.getTime();
            if (time === undefined || !Number.isFinite(time)) return Number.NEGATIVE_INFINITY;
            return time + (settingsRef.current.audioOffset || 0);
        },
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
    const handleStatsChange = useCallback((newStats: GameplayStats) => {
        statsRef.current = newStats;
    }, []);
    const handleFailed = useCallback(() => {
        setPausedMapTime(Math.max(0, getMapTime()));
        audioRef.current?.destroy();
        setFinalStats(statsRef.current);
        setPhase("failed");
    }, [getMapTime]);
    const handleCleared = useCallback(() => {
        audioRef.current?.destroy();
        setFinalStats(statsRef.current);
        setPhase("cleared");
    }, []);

    const handlePause = useCallback(async () => {
        if (phase !== "playing") return;
        setPausedMapTime(Math.max(0, getMapTime()));
        setFinalStats(statsRef.current);
        setPhase("paused");
        await audioRef.current?.pause();
    }, [phase, getMapTime]);

    const handleResume = useCallback(async () => {
        if (phase !== "paused") return;
        await audioRef.current?.resume();
        if (mountedRef.current) setPhase("playing");
    }, [phase]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Escape") {
                e.preventDefault();
                if (phase === "playing") {
                    void handlePause();
                } else if (phase === "paused") {
                    void handleResume();
                }
            } else if (phase === "paused") {
                if (e.code === "KeyR") {
                    e.preventDefault();
                    onRetry();
                }
            }
        };

        const handleBlur = () => {
            if (phase === "playing") {
                void handlePause();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("blur", handleBlur);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("blur", handleBlur);
        };
    }, [phase, handlePause, handleResume, onRetry]);

    useEffect(() => {
        const musicVol = ((settings.masterVolume ?? 100) / 100) * ((settings.musicVolume ?? 80) / 100) * 0.75;
        audioRef.current?.setVolume(musicVol);
    }, [settings.masterVolume, settings.musicVolume]);

    async function handleStart(): Promise<void> {
        const audio = audioRef.current;
        if (phase !== "ready" || !audio) return;

        setPhase("starting");
        incrementPlayCount(setId, difficulty.id);

        try {
            const musicVol = ((settings.masterVolume ?? 100) / 100) * ((settings.musicVolume ?? 80) / 100) * 0.75;
            await audio.start(preparedBeatmap.preRollMs, musicVol);
            if (mountedRef.current) setPhase("playing");
        } catch (error) {
            if (mountedRef.current) handleError(error);
        }
    }

    const isGameActive = phase === "playing" || phase === "paused";
    const isPaused = phase === "paused";

    return (
        <main className="game-page">
            {audioDurationMs !== undefined && (
                <GameCanvas
                    beatmap={difficulty.parsed}
                    preparedBeatmap={preparedBeatmap}
                    audioDurationMs={audioDurationMs}
                    audioContext={audioContext}
                    backgroundUrl={backgroundUrl}
                    backgroundDim={settings.backgroundDim}
                    fpsLimit={settings.fpsLimit}
                    settings={settings}
                    isPlaying={isGameActive}
                    isPaused={isPaused}
                    getMapTime={getMapTime}
                    onStatsChange={handleStatsChange}
                    onReady={handleGameReady}
                    onError={handleError}
                    onFailed={handleFailed}
                    onCleared={handleCleared}
                />
            )}

            {phase === "paused" && (
                <PauseOverlay
                    stats={finalStats}
                    currentTimeMs={pausedMapTime}
                    totalDurationMs={audioDurationMs ?? preparedBeatmap.lastObjectTime ?? 1}
                    retryCount={retryCount}
                    onResume={() => void handleResume()}
                    onRetry={onRetry}
                    onExit={onExit}
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

            {phase === "cleared" && (
                <RankingScreen
                    setId={setId}
                    stats={finalStats}
                    difficulty={difficulty}
                    backgroundUrl={backgroundUrl}
                    maxComboPossible={preparedBeatmap.maxCombo}
                    settings={settings}
                    onRetry={onRetry}
                    onExit={onExit}
                />
            )}

            {phase === "failed" && (
                <FailOverlay
                    stats={finalStats}
                    currentTimeMs={pausedMapTime}
                    totalDurationMs={audioDurationMs ?? preparedBeatmap.lastObjectTime ?? 1}
                    retryCount={retryCount}
                    onRetry={onRetry}
                    onExit={onExit}
                />
            )}

            {phase === "error" && (
                <div className="game-overlay" role="status">
                    <div className="game-dialog">
                        <h1>Could not start gameplay</h1>
                        <p style={{ color: "#eb5757" }}>{errorMessage}</p>
                        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                            <button onClick={onRetry}>↺ Retry</button>
                            <button className="game-back" onClick={onExit}>✕ Back to Menu</button>
                        </div>
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
            retryCount={attempt}
            onExit={onExit}
            onRetry={handleRetry}
        />
    );
}
