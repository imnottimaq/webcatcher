import { useEffect, useRef, useCallback } from "react";
import type { BeatmapDifficulty } from "../files/beatmap/beatmapImporter";
import SettingsPanel from "./SettingsPanel";
import type { SettingsState } from "./settingsTypes";
import styles from "./PlayerLoader.module.css";

interface PlayerLoaderProps {
    difficulty: BeatmapDifficulty;
    backgroundUrl?: string;
    isReady: boolean;
    settings: SettingsState;
    onSettingsChange<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void;
    onSettingsReset<K extends keyof SettingsState>(key: K): void;
    onStart(): void;
    onBack(): void;
}

function getStarRatingColor(stars?: number): string {
    if (stars === undefined || Number.isNaN(stars)) return "#eb5757";
    if (stars < 2.0) return "#4bb8f5";
    if (stars < 2.7) return "#7cdb4d";
    if (stars < 4.0) return "#f7c83c";
    if (stars < 5.3) return "#eb5757";
    if (stars < 6.5) return "#de3163";
    return "#7b1fa2";
}

export default function PlayerLoader({
    difficulty,
    backgroundUrl,
    isReady,
    settings,
    onSettingsChange,
    onSettingsReset,
    onStart,
    onBack,
}: PlayerLoaderProps) {
    const isReadyRef = useRef(isReady);
    const onStartRef = useRef(onStart);

    useEffect(() => {
        isReadyRef.current = isReady;
        onStartRef.current = onStart;
    });

    const isHoveredRef = useRef(false);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startedRef = useRef(false);

    const tryStart = useCallback(() => {
        if (startedRef.current) return;
        if (!isReady) return;
        if (isHoveredRef.current) return;
        if (leaveTimerRef.current !== null) return;

        startedRef.current = true;
        onStart();
    }, [isReady, onStart]);

    useEffect(() => {
        tryStart();
    }, [tryStart]);

    const handleSettingsMouseEnter = useCallback(() => {
        isHoveredRef.current = true;
        if (leaveTimerRef.current !== null) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }
    }, []);

    const handleSettingsMouseLeave = useCallback(() => {
        isHoveredRef.current = false;
        if (leaveTimerRef.current !== null) {
            clearTimeout(leaveTimerRef.current);
        }
        leaveTimerRef.current = setTimeout(() => {
            leaveTimerRef.current = null;
            if (!startedRef.current && isReadyRef.current && !isHoveredRef.current) {
                startedRef.current = true;
                onStartRef.current();
            }
        }, 750);
    }, []);

    useEffect(() => {
        return () => {
            if (leaveTimerRef.current !== null) {
                clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = null;
            }
        };
    }, []);

    const handleManualStart = useCallback(() => {
        if (!isReady || startedRef.current) return;
        if (leaveTimerRef.current !== null) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }
        startedRef.current = true;
        onStart();
    }, [isReady, onStart]);

    const starRating = difficulty.starRating ?? 4.30;
    const starColor = getStarRatingColor(starRating);

    const title = difficulty.parsed.metadata.title || "Unknown Title";
    const artist = difficulty.parsed.metadata.artist || "Unknown Artist";
    const source = difficulty.parsed.metadata.source || "—";
    const creator = difficulty.parsed.metadata.creator || "—";

    return (
        <div className={styles.playerLoader} role="dialog" aria-modal="true" aria-label="Beatmap loading screen">
            {backgroundUrl && (
                <div
                    className={styles.loaderBackground}
                    style={{
                        backgroundImage: `url(${backgroundUrl})`,
                        filter: `brightness(${Math.max(0.04, 1 - settings.backgroundDim / 100)}) blur(${(settings.backgroundBlur / 100) * 24}px)`,
                    }}
                />
            )}
            <div className={styles.vignetteOverlay} />

            <main className={styles.centerColumn}>
                <h1 className={styles.songTitle}>{title}</h1>
                <h2 className={styles.songArtist}>{artist}</h2>
                <div
                    className={`${styles.previewCard} ${isReady ? styles.previewCardReady : ""}`}
                    onClick={isReady ? handleManualStart : undefined}
                    role="button"
                    tabIndex={0}
                >
                    {backgroundUrl && (
                        <img
                            src={backgroundUrl}
                            alt="Beatmap banner preview"
                            className={styles.previewImage}
                        />
                    )}
                </div>
                <div className={styles.difficultyRow}>
                    <h3 className={styles.difficultyName}>{difficulty.versionName}</h3>
                </div>
                <div
                    className={styles.starRatingPill}
                    style={{ backgroundColor: starColor }}
                >
                    <span className={styles.starIcon}>★</span>
                    <span>{starRating.toFixed(2)}</span>
                </div>
                <div className={styles.metadataGrid}>
                    <span className={styles.metaLabel}>Source</span>
                    <span className={styles.metaValue}>{source}</span>
                    <span className={styles.metaLabel}>Mapper</span>
                    <span className={styles.metaValue}>{creator}</span>
                </div>
            </main>
            <SettingsPanel
                settings={settings}
                onChange={onSettingsChange}
                onReset={onSettingsReset}
                onMouseEnter={handleSettingsMouseEnter}
                onMouseLeave={handleSettingsMouseLeave}
            />

            <footer className={styles.bottomBar}>
                <button
                    type="button"
                    className={styles.backButton}
                    onClick={onBack}
                    title="Return to song select"
                >
                    <span className={styles.backButtonInner}>
                        <span className={styles.backChevron}>‹</span>
                        <span>Back</span>
                    </span>
                </button>
            </footer>
        </div>
    );
}
