import React, { useEffect } from "react";
import type { GameplayStats } from "./gameplayStats";
import failsoundAudioUrl from "../assets/skins/default/failsound.mp3?url";
import styles from "./FailOverlay.module.css";

interface FailOverlayProps {
    stats: GameplayStats;
    currentTimeMs: number;
    totalDurationMs: number;
    retryCount?: number;
    onRetry(): void;
    onExit(): void;
}

function ButtonTriangles() {
    return (
        <svg
            className={styles.btnTriangles}
            viewBox="0 0 800 64"
            preserveAspectRatio="none"
        >
            <polygon points="40,8 70,55 10,50" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
            <polygon points="120,4 150,60 90,50" fill="rgba(255,255,255,0.06)" />
            <polygon points="200,14 230,55 170,45" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <polygon points="280,4 310,60 250,55" fill="rgba(255,255,255,0.08)" />
            <polygon points="360,8 390,50 330,45" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <polygon points="440,6 470,58 410,50" fill="rgba(255,255,255,0.07)" />
            <polygon points="520,10 550,54 490,48" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
            <polygon points="600,4 630,58 570,52" fill="rgba(255,255,255,0.06)" />
            <polygon points="680,8 710,55 650,45" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
            <polygon points="750,6 780,56 720,50" fill="rgba(255,255,255,0.08)" />
        </svg>
    );
}

export const FailOverlay: React.FC<FailOverlayProps> = ({
    stats,
    currentTimeMs,
    totalDurationMs,
    retryCount = 0,
    onRetry,
    onExit,
}) => {
    const progressRatio = totalDurationMs > 0
        ? Math.max(0, Math.min(1, currentTimeMs / totalDurationMs))
        : 0;
    const progressPercent = Math.round(progressRatio * 100);

    useEffect(() => {
        const audio = new Audio(failsoundAudioUrl);
        audio.volume = 0.85;
        void audio.play().catch(() => {});
        return () => {
            audio.pause();
            audio.src = "";
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "KeyR" || e.code === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                onRetry();
            } else if (e.code === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onExit();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onRetry, onExit]);

    return (
        <div className={styles.failOverlay} role="dialog" aria-modal="true" aria-label="Map Failed">
            <div className={styles.failedTitle}>failed</div>

            <div className={styles.buttonStack}>
                <button
                    type="button"
                    className={`${styles.lazerSkewBtn} ${styles.retryBtn}`}
                    onClick={onRetry}
                    autoFocus
                >
                    <ButtonTriangles />
                    <span className={styles.btnText}>Retry</span>
                </button>

                <button
                    type="button"
                    className={`${styles.lazerSkewBtn} ${styles.quitBtn}`}
                    onClick={onExit}
                >
                    <ButtonTriangles />
                    <span className={styles.btnText}>Quit</span>
                </button>
            </div>

            <div className={styles.bottomStats}>
                <div className={styles.statRow}>
                    <span className={styles.statLabel}>Retry count:</span>
                    <span className={styles.statVal}>{retryCount}</span>
                </div>
                <div className={styles.statRow}>
                    <span className={styles.statLabel}>Song progress:</span>
                    <span className={styles.statVal}>{progressPercent}%</span>
                </div>
                <div className={styles.statRow}>
                    <span className={styles.statLabel}>Accuracy:</span>
                    <span className={styles.statVal}>{(stats.accuracy * 100).toFixed(2)}%</span>
                </div>
            </div>
        </div>
    );
};

export default FailOverlay;
