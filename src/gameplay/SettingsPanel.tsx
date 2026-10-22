import React, { useState, useEffect } from "react";
import { DEFAULT_SETTINGS, formatKeyName, type SettingsState } from "./settingsTypes";
import styles from "./SettingsPanel.module.css";

interface SettingsPanelProps {
    settings: SettingsState;
    onChange<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void;
    onReset<K extends keyof SettingsState>(key: K): void;
    className?: string;
    style?: React.CSSProperties;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    settings,
    onChange,
    onReset,
    className,
    style,
    onMouseEnter,
    onMouseLeave,
}) => {
    const [rebindingKey, setRebindingKey] = useState<keyof SettingsState | null>(null);

    useEffect(() => {
        if (!rebindingKey) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.code === "Escape") {
                setRebindingKey(null);
                return;
            }

            onChange(rebindingKey, e.code as SettingsState[typeof rebindingKey]);
            setRebindingKey(null);
        };

        window.addEventListener("keydown", handleKeyDown, { capture: true });
        return () => {
            window.removeEventListener("keydown", handleKeyDown, { capture: true });
        };
    }, [rebindingKey, onChange]);

    const hasCustomKeys = settings.leftKey1 !== DEFAULT_SETTINGS.leftKey1
        || settings.leftKey2 !== DEFAULT_SETTINGS.leftKey2
        || settings.rightKey1 !== DEFAULT_SETTINGS.rightKey1
        || settings.rightKey2 !== DEFAULT_SETTINGS.rightKey2
        || settings.dashKey1 !== DEFAULT_SETTINGS.dashKey1
        || settings.dashKey2 !== DEFAULT_SETTINGS.dashKey2;

    const handleResetKeys = () => {
        onReset("leftKey1");
        onReset("leftKey2");
        onReset("rightKey1");
        onReset("rightKey2");
        onReset("dashKey1");
        onReset("dashKey2");
    };
    return (
        <aside
            className={`${styles.settingsPanel} ${className ?? ""}`.trim()}
            style={style}
            aria-label="Game Settings"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className={styles.section}>
                <h3 className={styles.sectionHeader}>VISUAL SETTINGS</h3>

                <div className={styles.controlGroup}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.backgroundDim !== DEFAULT_SETTINGS.backgroundDim ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("backgroundDim")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Background dim</span>
                    </div>
                    <div className={styles.sliderWrapper}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.backgroundDim}
                            className={styles.slider}
                            style={{
                                "--slider-progress": `${settings.backgroundDim}%`,
                            } as React.CSSProperties}
                            onChange={(e) => onChange("backgroundDim", Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className={styles.controlGroup}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.backgroundBlur !== DEFAULT_SETTINGS.backgroundBlur ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("backgroundBlur")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Background blur</span>
                    </div>
                    <div className={styles.sliderWrapper}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.backgroundBlur}
                            className={styles.slider}
                            style={{
                                "--slider-progress": `${settings.backgroundBlur}%`,
                            } as React.CSSProperties}
                            onChange={(e) => onChange("backgroundBlur", Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className={styles.controlRow}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.storyboardVideo !== DEFAULT_SETTINGS.storyboardVideo ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("storyboardVideo")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Storyboard / video</span>
                    </div>
                    <button
                        type="button"
                        className={`${styles.toggleSwitch} ${settings.storyboardVideo ? styles.toggleActive : ""}`}
                        onClick={() => onChange("storyboardVideo", !settings.storyboardVideo)}
                        aria-pressed={settings.storyboardVideo}
                    >
                        <span className={styles.toggleThumb} />
                    </button>
                </div>

                <div className={styles.controlRow}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.beatmapSkins !== DEFAULT_SETTINGS.beatmapSkins ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("beatmapSkins")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Beatmap skins</span>
                    </div>
                    <button
                        type="button"
                        className={`${styles.toggleSwitch} ${settings.beatmapSkins ? styles.toggleActive : ""}`}
                        onClick={() => onChange("beatmapSkins", !settings.beatmapSkins)}
                        aria-pressed={settings.beatmapSkins}
                    >
                        <span className={styles.toggleThumb} />
                    </button>
                </div>

                <div className={styles.controlRow}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.beatmapColours !== DEFAULT_SETTINGS.beatmapColours ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("beatmapColours")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Beatmap colours</span>
                    </div>
                    <button
                        type="button"
                        className={`${styles.toggleSwitch} ${settings.beatmapColours ? styles.toggleActive : ""}`}
                        onClick={() => onChange("beatmapColours", !settings.beatmapColours)}
                        aria-pressed={settings.beatmapColours}
                    >
                        <span className={styles.toggleThumb} />
                    </button>
                </div>

                <div className={styles.controlGroup}>
                    <div className={styles.labelRow}>
                        <span className={styles.labelIndent}>Combo colour normalisation</span>
                    </div>
                    <div className={styles.sliderWrapper}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.comboColourNormalisation}
                            className={styles.slider}
                            style={{
                                "--slider-progress": `${settings.comboColourNormalisation}%`,
                            } as React.CSSProperties}
                            onChange={(e) => onChange("comboColourNormalisation", Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className={styles.controlRow}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.hitLighting !== DEFAULT_SETTINGS.hitLighting ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("hitLighting")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Hit lighting</span>
                    </div>
                    <button
                        type="button"
                        className={`${styles.toggleSwitch} ${settings.hitLighting ? styles.toggleActive : ""}`}
                        onClick={() => onChange("hitLighting", !settings.hitLighting)}
                        aria-pressed={settings.hitLighting}
                    >
                        <span className={styles.toggleThumb} />
                    </button>
                </div>

                <div className={styles.controlRow}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.showFpsCounter !== DEFAULT_SETTINGS.showFpsCounter ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("showFpsCounter")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Show FPS counter (Ctrl+F11)</span>
                    </div>
                    <button
                        type="button"
                        className={`${styles.toggleSwitch} ${settings.showFpsCounter ? styles.toggleActive : ""}`}
                        onClick={() => onChange("showFpsCounter", !settings.showFpsCounter)}
                        aria-pressed={settings.showFpsCounter}
                    >
                        <span className={styles.toggleThumb} />
                    </button>
                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionHeader}>AUDIO SETTINGS</h3>

                <div className={styles.controlGroup}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.masterVolume !== DEFAULT_SETTINGS.masterVolume ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("masterVolume")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Master volume</span>
                    </div>
                    <div className={styles.sliderWrapper}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.masterVolume}
                            className={styles.slider}
                            style={{
                                "--slider-progress": `${settings.masterVolume}%`,
                            } as React.CSSProperties}
                            onChange={(e) => onChange("masterVolume", Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className={styles.controlGroup}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.musicVolume !== DEFAULT_SETTINGS.musicVolume ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("musicVolume")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Music volume</span>
                    </div>
                    <div className={styles.sliderWrapper}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.musicVolume}
                            className={styles.slider}
                            style={{
                                "--slider-progress": `${settings.musicVolume}%`,
                            } as React.CSSProperties}
                            onChange={(e) => onChange("musicVolume", Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className={styles.controlGroup}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.hitsoundVolume !== DEFAULT_SETTINGS.hitsoundVolume ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("hitsoundVolume")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Hitsound volume</span>
                    </div>
                    <div className={styles.sliderWrapper}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.hitsoundVolume}
                            className={styles.slider}
                            style={{
                                "--slider-progress": `${settings.hitsoundVolume}%`,
                            } as React.CSSProperties}
                            onChange={(e) => onChange("hitsoundVolume", Number(e.target.value))}
                        />
                    </div>
                </div>

                <div className={styles.controlRow}>
                    <div className={styles.labelRow}>
                        <button
                            type="button"
                            className={`${styles.resetButton} ${settings.beatmapHitsounds !== DEFAULT_SETTINGS.beatmapHitsounds ? styles.resetVisible : ""}`}
                            title="Reset to default"
                            onClick={() => onReset("beatmapHitsounds")}
                        >
                            ↺
                        </button>
                        <span className={styles.label}>Beatmap hitsounds</span>
                    </div>
                    <button
                        type="button"
                        className={`${styles.toggleSwitch} ${settings.beatmapHitsounds ? styles.toggleActive : ""}`}
                        onClick={() => onChange("beatmapHitsounds", !settings.beatmapHitsounds)}
                        aria-pressed={settings.beatmapHitsounds}
                    >
                        <span className={styles.toggleThumb} />
                    </button>
                </div>

                <div className={styles.controlGroup}>
                    <div className={styles.labelRow}>
                        <span className={styles.labelIndent}>Audio offset (this beatmap)</span>
                    </div>
                    <div className={styles.sliderWrapper}>
                        <input
                            type="range"
                            min="-100"
                            max="100"
                            value={settings.audioOffset}
                            className={styles.slider}
                            style={{
                                "--slider-progress": `${((settings.audioOffset + 100) / 200) * 100}%`,
                            } as React.CSSProperties}
                            onChange={(e) => onChange("audioOffset", Number(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            <div className={styles.section}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 className={styles.sectionHeader}>INPUT SETTINGS</h3>
                    {hasCustomKeys && (
                        <button
                            type="button"
                            className={styles.resetButton}
                            title="Reset all keybinds to defaults"
                            onClick={handleResetKeys}
                            style={{ fontSize: "11px", width: "auto", opacity: 0.9 }}
                        >
                            Reset keys ↺
                        </button>
                    )}
                </div>

                <div className={styles.keybindRow}>
                    <span className={styles.keybindLabel}>Move Left</span>
                    <div className={styles.keybindButtons}>
                        <button
                            type="button"
                            className={`${styles.keybindButton} ${rebindingKey === "leftKey1" ? styles.keybindButtonActive : ""}`}
                            onClick={() => setRebindingKey(rebindingKey === "leftKey1" ? null : "leftKey1")}
                            title="Click to rebind key 1"
                        >
                            {rebindingKey === "leftKey1" ? "..." : formatKeyName(settings.leftKey1)}
                        </button>
                        <button
                            type="button"
                            className={`${styles.keybindButton} ${rebindingKey === "leftKey2" ? styles.keybindButtonActive : ""}`}
                            onClick={() => setRebindingKey(rebindingKey === "leftKey2" ? null : "leftKey2")}
                            title="Click to rebind key 2"
                        >
                            {rebindingKey === "leftKey2" ? "..." : formatKeyName(settings.leftKey2)}
                        </button>
                    </div>
                </div>

                <div className={styles.keybindRow}>
                    <span className={styles.keybindLabel}>Move Right</span>
                    <div className={styles.keybindButtons}>
                        <button
                            type="button"
                            className={`${styles.keybindButton} ${rebindingKey === "rightKey1" ? styles.keybindButtonActive : ""}`}
                            onClick={() => setRebindingKey(rebindingKey === "rightKey1" ? null : "rightKey1")}
                            title="Click to rebind key 1"
                        >
                            {rebindingKey === "rightKey1" ? "..." : formatKeyName(settings.rightKey1)}
                        </button>
                        <button
                            type="button"
                            className={`${styles.keybindButton} ${rebindingKey === "rightKey2" ? styles.keybindButtonActive : ""}`}
                            onClick={() => setRebindingKey(rebindingKey === "rightKey2" ? null : "rightKey2")}
                            title="Click to rebind key 2"
                        >
                            {rebindingKey === "rightKey2" ? "..." : formatKeyName(settings.rightKey2)}
                        </button>
                    </div>
                </div>

                <div className={styles.keybindRow}>
                    <span className={styles.keybindLabel}>Dash (Speed)</span>
                    <div className={styles.keybindButtons}>
                        <button
                            type="button"
                            className={`${styles.keybindButton} ${rebindingKey === "dashKey1" ? styles.keybindButtonActive : ""}`}
                            onClick={() => setRebindingKey(rebindingKey === "dashKey1" ? null : "dashKey1")}
                            title="Click to rebind key 1"
                        >
                            {rebindingKey === "dashKey1" ? "..." : formatKeyName(settings.dashKey1)}
                        </button>
                        <button
                            type="button"
                            className={`${styles.keybindButton} ${rebindingKey === "dashKey2" ? styles.keybindButtonActive : ""}`}
                            onClick={() => setRebindingKey(rebindingKey === "dashKey2" ? null : "dashKey2")}
                            title="Click to rebind key 2"
                        >
                            {rebindingKey === "dashKey2" ? "..." : formatKeyName(settings.dashKey2)}
                        </button>
                    </div>
                </div>

                <div className={styles.controlRow}>
                    <div className={styles.labelRow}>
                        <span className={styles.labelIndent}>Disable clicks during gameplay</span>
                    </div>
                    <button
                        type="button"
                        className={`${styles.toggleSwitch} ${settings.disableClicks ? styles.toggleActive : ""}`}
                        onClick={() => onChange("disableClicks", !settings.disableClicks)}
                        aria-pressed={settings.disableClicks}
                    >
                        <span className={styles.toggleThumb} />
                    </button>
                </div>
            </div>

        </aside>
    );
};

export default SettingsPanel;
