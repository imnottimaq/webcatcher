import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./FpsCounter.module.css";
import { fpsTracker } from "../utils/fpsTracker";

type FpsDisplayMode = "full" | "fpsOnly" | "hidden";

const STORAGE_KEY = "webcatcher_fps_mode";

function getMsColor(ms: number): string {
    if (ms <= 4.5) return "#b37eff";
    if (ms <= 8.5) return "#52e5ff";
    if (ms <= 17) return "#7cdb4d";
    if (ms <= 34) return "#ffd633";
    return "#eb5757";
}

export default function FpsCounter() {
    const [mode, setMode] = useState<FpsDisplayMode>(() => {
        try {
            const settingsRaw = localStorage.getItem("webcatcher_settings");
            if (settingsRaw) {
                const parsed = JSON.parse(settingsRaw);
                if (parsed.showFpsCounter === false) return "hidden";
            }
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === "full" || saved === "fpsOnly") {
                return saved;
            }
        } catch {
            void 0;
        }
        return "full";
    });

    const msRef = useRef<HTMLSpanElement>(null);
    const fpsRef = useRef<HTMLSpanElement>(null);

    const cycleMode = useCallback(() => {
        setMode((prev) => {
            const next: FpsDisplayMode =
                prev === "full" ? "fpsOnly" : prev === "fpsOnly" ? "hidden" : "full";
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch {
                void 0;
            }
            return next;
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.shiftKey) && (e.code === "F11" || e.key === "F11")) {
                e.preventDefault();
                cycleMode();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [cycleMode]);

    useEffect(() => {
        if (mode === "hidden") return;

        const unsubscribe = fpsTracker.subscribe((calculatedFps, avgDelta) => {
            if (fpsRef.current) {
                fpsRef.current.textContent = `${calculatedFps} fps`;
            }
            if (msRef.current) {
                const formattedMs = avgDelta < 10 ? avgDelta.toFixed(1) : Math.round(avgDelta).toString();
                msRef.current.textContent = `${formattedMs} ms`;
                msRef.current.style.color = getMsColor(avgDelta);
            }
        });

        return unsubscribe;
    }, [mode]);

    if (mode === "hidden") return null;

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
                    ref={msRef}
                    className={styles.msValue}
                    style={{ color: "#52e5ff" }}
                >
                    -- ms
                </span>
            )}
            <span ref={fpsRef} className={styles.fpsValue}>-- fps</span>
        </div>
    );
}
