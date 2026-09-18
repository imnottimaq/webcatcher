import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./FpsCounter.module.css";

type FpsDisplayMode = "full" | "fpsOnly" | "hidden";

const STORAGE_KEY = "webcatcher_fps_mode";

function getMsColor(ms: number): string {
    if (ms <= 10) return "#7cdb4d"; // > 100 fps (green)
    if (ms <= 17) return "#ffd633"; // ~60-100 fps (yellow)
    if (ms <= 35) return "#e07a5f"; // ~30-60 fps (salmon/orange, matches osu!lazer)
    return "#eb5757";               // < 30 fps (red)
}

export default function FpsCounter() {
    const [mode, setMode] = useState<FpsDisplayMode>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === "full" || saved === "fpsOnly" || saved === "hidden") {
                return saved;
            }
        } catch {
            // ignore storage access error
        }
        return "full";
    });

    const [displayFps, setDisplayFps] = useState<number>(60);
    const [displayMs, setDisplayMs] = useState<number>(16);

    const cycleMode = useCallback(() => {
        setMode((prev) => {
            const next: FpsDisplayMode =
                prev === "full" ? "fpsOnly" : prev === "fpsOnly" ? "hidden" : "full";
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

    // Listen for Ctrl+F11 or Shift+F11 to toggle mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.shiftKey) && e.code === "F11") {
                e.preventDefault();
                cycleMode();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [cycleMode]);

    // High-performance RAF measurement loop
    const stateRef = useRef({
        lastTime: 0,
        frames: 0,
        totalDelta: 0,
        lastUpdate: 0,
    });

    useEffect(() => {
        if (mode === "hidden") return;

        let animId: number;
        stateRef.current.lastTime = performance.now();
        stateRef.current.lastUpdate = performance.now();
        stateRef.current.frames = 0;
        stateRef.current.totalDelta = 0;

        const tick = (now: number) => {
            const delta = now - stateRef.current.lastTime;
            stateRef.current.lastTime = now;

            // Ignore extreme tab-switch / background pauses (> 1s)
            if (delta > 0 && delta < 1000) {
                stateRef.current.frames += 1;
                stateRef.current.totalDelta += delta;
            }

            const elapsedSinceUpdate = now - stateRef.current.lastUpdate;
            if (elapsedSinceUpdate >= 200 && stateRef.current.frames > 0) {
                const avgDelta = stateRef.current.totalDelta / stateRef.current.frames;
                const calculatedFps = Math.round((stateRef.current.frames * 1000) / elapsedSinceUpdate);

                setDisplayFps(calculatedFps);
                setDisplayMs(avgDelta);

                stateRef.current.frames = 0;
                stateRef.current.totalDelta = 0;
                stateRef.current.lastUpdate = now;
            }

            animId = requestAnimationFrame(tick);
        };

        animId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animId);
    }, [mode]);

    if (mode === "hidden") return null;

    const formattedMs = displayMs < 10 ? displayMs.toFixed(1) : Math.round(displayMs).toString();

    return (
        <div
            className={styles.fpsContainer}
            onClick={cycleMode}
            title="Performance Monitor (Click or Ctrl+F11 to toggle)"
            role="status"
            aria-live="off"
        >
            {mode === "full" && (
                <span
                    className={styles.msValue}
                    style={{ color: getMsColor(displayMs) }}
                >
                    {formattedMs} ms
                </span>
            )}
            <span className={styles.fpsValue}>{displayFps} fps</span>
        </div>
    );
}
