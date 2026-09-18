import type { CSSProperties } from "react";
import type { GameplayStats } from "./gameplayStats";
import styles from "./GameHUD.module.css";

interface GameHUDProps {
    stats: GameplayStats;
}

function clampNormalized(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

export default function GameHUD({ stats }: GameHUDProps) {
    const numericScore = Number.isFinite(stats.score)
        ? Math.max(0, Math.trunc(stats.score)) : 0;
    const score = numericScore.toString().padStart(6, "0");
    const accuracy = clampNormalized(stats.accuracy);
    const health = clampNormalized(stats.health);
    const healthPercent = health * 100;
    const healthStyle = {
        "--health-width": `${healthPercent}%`,
    } as CSSProperties;

    return (
        <div className={styles.hud}>
            <div className={styles.health}>
                <div className={styles.healthLabel}>
                    <span>HP</span>
                    <span>{healthPercent.toFixed(0)}%</span>
                </div>
                <div
                    className={styles.healthTrack}
                    role="meter"
                    aria-label="Health"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(healthPercent)}
                    aria-valuetext={`${healthPercent.toFixed(0)} percent`}
                >
                    <div className={styles.healthFill} style={healthStyle} />
                </div>
            </div>

            <div className={styles.stats}>
                <output className={styles.score} aria-label={`Score ${score}`}>
                    {score}
                </output>
                <output
                    className={styles.accuracy}
                    aria-label={`Accuracy ${(accuracy * 100).toFixed(2)} percent`}
                >
                    {(accuracy * 100).toFixed(2)}%
                </output>
            </div>
        </div>
    );
}
