import React, { useEffect, useState } from "react";
import type { BeatmapDifficulty } from "../files/beatmap/beatmapImporter";
import type { GameplayStats } from "./gameplayStats";
import type { SettingsState } from "./settingsTypes";
import styles from "./RankingScreen.module.css";

import rankXImg from "../assets/skins/default/ranking-X@2x.png";
import rankSImg from "../assets/skins/default/ranking-S@2x.png";
import rankAImg from "../assets/skins/default/ranking-A@2x.png";
import rankBImg from "../assets/skins/default/ranking-B@2x.png";
import rankCImg from "../assets/skins/default/ranking-C@2x.png";
import rankDImg from "../assets/skins/default/ranking-D@2x.png";
import applauseAudioUrl from "../assets/skins/default/applause.mp3?url";

import { saveLocalScore } from "./localScores";

interface RankingScreenProps {
    setId: string;
    stats: GameplayStats;
    difficulty: BeatmapDifficulty;
    backgroundUrl?: string;
    maxComboPossible?: number;
    settings: SettingsState;
    onRetry(): void;
    onExit(): void;
}

export type RankGrade = "SS" | "S" | "A" | "B" | "C" | "D";

function getStarRatingColor(stars?: number): string {
    if (stars === undefined || Number.isNaN(stars)) return "#eb5757";
    if (stars < 2.0) return "#4bb8f5";
    if (stars < 2.7) return "#7cdb4d";
    if (stars < 4.0) return "#f7c83c";
    if (stars < 5.3) return "#eb5757";
    if (stars < 6.5) return "#de3163";
    return "#7b1fa2";
}

function calculateGrade(accuracy: number, misses: number): RankGrade {
    if (accuracy >= 0.9999) return "SS";
    if (misses === 0 && accuracy >= 0.98) return "S";
    if (accuracy >= 0.98) return "S";
    if (accuracy >= 0.94) return "A";
    if (accuracy >= 0.90) return "B";
    if (accuracy >= 0.85) return "C";
    return "D";
}

function getGradeImage(grade: RankGrade): string {
    switch (grade) {
        case "SS":
            return rankXImg;
        case "S":
            return rankSImg;
        case "A":
            return rankAImg;
        case "B":
            return rankBImg;
        case "C":
            return rankCImg;
        case "D":
        default:
            return rankDImg;
    }
}

function getGradeGlowColor(grade: RankGrade): string {
    switch (grade) {
        case "SS":
            return "#ffd633";
        case "S":
            return "#ff66aa";
        case "A":
            return "#7cdb4d";
        case "B":
            return "#4bb8f5";
        case "C":
            return "#bb6bd9";
        case "D":
        default:
            return "#eb5757";
    }
}

export const RankingScreen: React.FC<RankingScreenProps> = ({
    setId,
    stats,
    difficulty,
    backgroundUrl,
    maxComboPossible,
    settings,
    onRetry,
    onExit,
}) => {
    const [animatedScore, setAnimatedScore] = useState(0);
    const [animatedAcc, setAnimatedAcc] = useState(0);

    const title = difficulty.parsed.metadata.title || "Unknown Title";
    const artist = difficulty.parsed.metadata.artist || "Unknown Artist";
    const creator = difficulty.parsed.metadata.creator || "Unknown Mapper";
    const versionName = difficulty.versionName || "Normal";
    const starRating = difficulty.starRating;
    const starColor = getStarRatingColor(starRating);

    const grade = calculateGrade(stats.accuracy, stats.misses);
    const gradeImg = getGradeImage(grade);
    const glowColor = getGradeGlowColor(grade);

    const isFullCombo = stats.misses === 0 && stats.maxCombo > 0;

    const [saveResult] = useState(() => saveLocalScore(setId, difficulty.id, {
        playerName: settings.username || "ImNotTima",
        score: stats.score,
        maxCombo: stats.maxCombo,
        accuracy: stats.accuracy * 100,
        grade,
        fruitsHit: stats.fruitsHit,
        dropletsHit: stats.dropletsHit,
        tinyHit: stats.tinyHit,
        misses: stats.misses,
    }));
    const isPersonalBest = saveResult.isPersonalBest;
    const rankPos = saveResult.rank;

    useEffect(() => {
        const audio = new Audio(applauseAudioUrl);
        const masterVol = (settings.masterVolume ?? 100) / 100;
        const musicVol = (settings.musicVolume ?? 80) / 100;
        audio.volume = Math.max(0, Math.min(1, masterVol * musicVol * 0.7));

        void audio.play().catch(() => {});

        return () => {
            audio.pause();
            audio.src = "";
        };
    }, [settings.masterVolume, settings.musicVolume]);

    useEffect(() => {
        let startTime: number | undefined;
        let animationFrame: number;
        const duration = 1200;

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min(1, (timestamp - startTime) / duration);
            const ease = 1 - Math.pow(1 - progress, 3);

            setAnimatedScore(Math.floor(stats.score * ease));
            setAnimatedAcc(stats.accuracy * ease * 100);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(step);
            } else {
                setAnimatedScore(stats.score);
                setAnimatedAcc(stats.accuracy * 100);
            }
        };

        animationFrame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrame);
    }, [stats.score, stats.accuracy]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "KeyR") {
                e.preventDefault();
                onRetry();
            } else if (e.code === "Escape") {
                e.preventDefault();
                onExit();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onRetry, onExit]);

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Ranking Screen">
            {backgroundUrl && (
                <div
                    className={styles.bgBackdrop}
                    style={{ backgroundImage: `url(${backgroundUrl})` }}
                />
            )}
            <div className={styles.ambientGlow} />
            <div className={styles.vignette} />

            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.badgeRow}>
                        <span className={styles.rankingBadge}>osu!catch ranking</span>
                    </div>
                    <h1 className={styles.songTitle}>{title}</h1>
                    <h2 className={styles.songArtist}>{artist}</h2>
                </div>

                <div className={styles.headerRight}>
                    <div className={styles.diffBadge}>
                        <span className={styles.diffName}>{versionName}</span>
                        {starRating !== undefined && (
                            <span className={styles.starPill} style={{ backgroundColor: starColor }}>
                                <span>★</span>
                                <span>{starRating.toFixed(2)}</span>
                            </span>
                        )}
                    </div>
                    <span className={styles.mapperText}>
                        Beatmap by <span className={styles.mapperHighlight}>{creator}</span>
                    </span>
                </div>
            </header>

            <main className={styles.mainStage}>
                <div className={styles.contentCard}>
                    <div className={styles.leftCol}>
                        <div className={styles.gradeContainer}>
                            <div
                                className={styles.gradeGlow}
                                style={{ backgroundColor: glowColor }}
                            />
                            <img
                                src={gradeImg}
                                alt={`Rank ${grade}`}
                                className={styles.gradeImage}
                            />
                        </div>

                        <span className={styles.scoreLabel}>Total Score</span>
                        <div className={styles.scoreValue}>
                            {animatedScore.toLocaleString()}
                        </div>

                        <div className={styles.accRow}>
                            <span className={styles.accLabel}>Accuracy</span>
                            <span className={styles.accValue}>
                                {animatedAcc.toFixed(2)}%
                            </span>
                        </div>

                        {isFullCombo && (
                            <div className={styles.fcBadge}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffd633">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                                <span>PERFECT FULL COMBO!</span>
                            </div>
                        )}

                        {isPersonalBest && (
                            <div className={styles.fcBadge} style={{ background: "rgba(255, 214, 51, 0.15)", borderColor: "rgba(255, 214, 51, 0.4)", color: "#ffd633", marginTop: "8px" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffd633">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                                <span>NEW PERSONAL BEST! #{rankPos ?? 1}</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.rightCol}>
                        <div className={styles.statsTitle}>Performance Breakdown</div>

                        <div className={styles.statGrid}>
                            <div className={styles.statCard}>
                                <div className={styles.statCardLeft}>
                                    <span className={styles.statIcon}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="14" r="7" fill="rgba(34, 197, 94, 0.25)" />
                                            <path d="M12 7V4" />
                                            <path d="M12 4C14.5 4 16 5.5 16 7" />
                                        </svg>
                                    </span>
                                    <div className={styles.statLabel}>
                                        <span className={styles.statName}>Fruits</span>
                                        <span className={styles.statDesc}>300 pts</span>
                                    </div>
                                </div>
                                <span className={styles.statNum}>{stats.fruitsHit.toLocaleString()}</span>
                            </div>

                            <div className={styles.statCard}>
                                <div className={styles.statCardLeft}>
                                    <span className={styles.statIcon}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="rgba(56, 189, 248, 0.25)" />
                                        </svg>
                                    </span>
                                    <div className={styles.statLabel}>
                                        <span className={styles.statName}>Droplets</span>
                                        <span className={styles.statDesc}>100 pts</span>
                                    </div>
                                </div>
                                <span className={styles.statNum}>{stats.dropletsHit.toLocaleString()}</span>
                            </div>

                            <div className={styles.statCard}>
                                <div className={styles.statCardLeft}>
                                    <span className={styles.statIcon}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="5" fill="rgba(129, 140, 248, 0.35)" />
                                        </svg>
                                    </span>
                                    <div className={styles.statLabel}>
                                        <span className={styles.statName}>Ticks</span>
                                        <span className={styles.statDesc}>10 pts</span>
                                    </div>
                                </div>
                                <span className={styles.statNum}>{stats.tinyHit.toLocaleString()}</span>
                            </div>

                            <div className={styles.statCard}>
                                <div className={styles.statCardLeft}>
                                    <span className={styles.statIcon}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </span>
                                    <div className={styles.statLabel}>
                                        <span className={styles.statName}>Misses</span>
                                        <span className={styles.statDesc}>Dropped</span>
                                    </div>
                                </div>
                                <span className={`${styles.statNum} ${stats.misses > 0 ? styles.statNumMiss : styles.statNumZero}`}>
                                    {stats.misses}
                                </span>
                            </div>

                            <div className={styles.comboCard}>
                                <div className={styles.comboLabel}>
                                    <span className={styles.comboTitle}>Max Combo</span>
                                    <span className={styles.comboSub}>
                                        {maxComboPossible ? `Map maximum: ${maxComboPossible}x` : "Highest combo streak"}
                                    </span>
                                </div>
                                <span className={styles.comboValue}>
                                    {stats.maxCombo}x
                                    {maxComboPossible ? ` / ${maxComboPossible}x` : ""}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className={styles.bottomBar}>
                <div className={styles.hotkeyHints}>
                    <div className={styles.hintItem}>
                        <span className={styles.kbd}>R</span>
                        <span>Replay</span>
                    </div>
                    <div className={styles.hintItem}>
                        <span className={styles.kbd}>Esc</span>
                        <span>Song Select</span>
                    </div>
                </div>

                <div className={styles.actionButtons}>
                    <button
                        type="button"
                        className={styles.backBtn}
                        onClick={onExit}
                        title="Back to song select (Esc)"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        <span>Song Select</span>
                    </button>
                    <button
                        type="button"
                        className={styles.retryBtn}
                        onClick={onRetry}
                        title="Replay map (R)"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10"/>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                        </svg>
                        <span>Replay</span>
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default RankingScreen;
