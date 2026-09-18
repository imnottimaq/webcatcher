import type React from "react";
import { DEFAULT_SETTINGS, type SettingsState } from "./settingsTypes";
import styles from "./SettingsPanel.module.css";

interface SettingsPanelProps {
    settings: SettingsState;
    onChange<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void;
    onReset<K extends keyof SettingsState>(key: K): void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    settings,
    onChange,
    onReset,
}) => {
    return (
        <aside className={styles.settingsPanel} aria-label="Game Settings">
            {/* VISUAL SETTINGS */}
            <div className={styles.section}>
                <h3 className={styles.sectionHeader}>VISUAL SETTINGS</h3>

                {/* Background dim */}
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

                {/* Background blur */}
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
                            max="30"
                            value={settings.backgroundBlur}
                            className={styles.slider}
                            style={{
                                "--slider-progress": `${(settings.backgroundBlur / 30) * 100}%`,
                            } as React.CSSProperties}
                            onChange={(e) => onChange("backgroundBlur", Number(e.target.value))}
                        />
                    </div>
                </div>

                {/* Storyboard / video */}
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

                {/* Beatmap skins */}
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

                {/* Beatmap colours */}
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

                {/* Combo colour normalisation */}
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
            </div>

            {/* AUDIO SETTINGS */}
            <div className={styles.section}>
                <h3 className={styles.sectionHeader}>AUDIO SETTINGS</h3>

                {/* Beatmap hitsounds */}
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

                {/* Audio offset */}
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

            {/* INPUT SETTINGS */}
            <div className={styles.section}>
                <h3 className={styles.sectionHeader}>INPUT SETTINGS</h3>

                {/* Disable clicks during gameplay */}
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
