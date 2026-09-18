import { useEffect } from "react";
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
    // Space / Enter to start when ready, Escape to exit
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Escape") {
                e.preventDefault();
                onBack();
            } else if (e.code === "Space" || e.code === "Enter") {
                if (isReady) {
                    e.preventDefault();
                    onStart();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isReady, onStart, onBack]);

    const starRating = difficulty.starRating ?? 4.30;
    const starColor = getStarRatingColor(starRating);

    const title = difficulty.parsed.metadata.title || "Unknown Title";
    const artist = difficulty.parsed.metadata.artist || "Unknown Artist";
    const source = difficulty.parsed.metadata.source || "—";
    const creator = difficulty.parsed.metadata.creator || "—";

    return (
        <div className={styles.playerLoader} role="dialog" aria-modal="true" aria-label="Beatmap loading screen">
            {/* Dynamic Background with user-adjusted Dim and Blur */}
            {backgroundUrl && (
                <div
                    className={styles.loaderBackground}
                    style={{
                        backgroundImage: `url(${backgroundUrl})`,
                        filter: `brightness(${Math.max(0.04, 1 - settings.backgroundDim / 100)}) blur(${settings.backgroundBlur}px)`,
                    }}
                />
            )}
            <div className={styles.vignetteOverlay} />

            {/* Center Column: osu! logo, Song details, Preview card, Difficulty, Metadata */}
            <main className={styles.centerColumn}>
                {/* Iconic circular osu! logo */}
                <div
                    className={styles.osuLogo}
                    onClick={isReady ? onStart : undefined}
                    role="button"
                    tabIndex={0}
                    title={isReady ? "Click to start playing" : "Loading beatmap…"}
                >
                    <span className={styles.osuLogoText}>osu!</span>
                </div>

                {/* Song Title */}
                <h1 className={styles.songTitle}>{title}</h1>

                {/* Song Artist */}
                <h2 className={styles.songArtist}>{artist}</h2>

                {/* Beatmap Preview Banner Card */}
                <div
                    className={`${styles.previewCard} ${isReady ? styles.previewCardReady : ""}`}
                    onClick={isReady ? onStart : undefined}
                    role="button"
                    tabIndex={0}
                    title={isReady ? "Click to start playing (or press Space / Enter)" : "Loading beatmap…"}
                >
                    {backgroundUrl && (
                        <img
                            src={backgroundUrl}
                            alt="Beatmap banner preview"
                            className={styles.previewImage}
                        />
                    )}
                    <div className={styles.previewOverlay}>
                        {!isReady ? (
                            <div className={styles.loadingSpinner} />
                        ) : (
                            <div className={styles.readyIndicator}>
                                <span className={styles.playArrow}>▶</span>
                                <span className={styles.clickToPlayText}>Click to Start</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Difficulty Name */}
                <div className={styles.difficultyRow}>
                    <h3 className={styles.difficultyName}>{difficulty.versionName}</h3>
                </div>

                {/* Star Rating Badge Pill */}
                <div
                    className={styles.starRatingPill}
                    style={{ backgroundColor: starColor }}
                >
                    <span className={styles.starIcon}>★</span>
                    <span>{starRating.toFixed(2)}</span>
                </div>

                {/* Metadata Grid (Source & Mapper) */}
                <div className={styles.metadataGrid}>
                    <span className={styles.metaLabel}>Source</span>
                    <span className={styles.metaValue}>{source}</span>
                    <span className={styles.metaLabel}>Mapper</span>
                    <span className={styles.metaValue}>{creator}</span>
                </div>
            </main>

            {/* Right Settings Panel (VISUAL, AUDIO, INPUT) */}
            <SettingsPanel
                settings={settings}
                onChange={onSettingsChange}
                onReset={onSettingsReset}
            />

            {/* Bottom Bar: Back button on the left, FPS/ms monitor on the right */}
            <footer className={styles.bottomBar}>
                {/* Slanted Hot-Pink Back Button */}
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
