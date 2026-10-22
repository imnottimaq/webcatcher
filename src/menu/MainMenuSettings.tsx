import React, { useState, useEffect, useRef } from "react";
import { DEFAULT_SETTINGS, formatKeyName, type SettingsState } from "../gameplay/settingsTypes";
import styles from "./MainMenuSettings.module.css";

interface MainMenuSettingsProps {
    settings: SettingsState;
    onChange<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void;
    onReset<K extends keyof SettingsState>(key: K): void;
    onResetAll(): void;
    onClose(): void;
    skinList?: string[];
    activeSkinName?: string;
    onSelectSkin?(name: string): void;
    onImportSkin?(): void;
    isImportingSkin?: boolean;
    skinMessage?: string;
    onClearData?(): void;
}

type SectionKey = "audio" | "visual" | "input" | "skin";

export const MainMenuSettings: React.FC<MainMenuSettingsProps> = ({
    settings,
    onChange,
    onReset,
    onResetAll,
    onClose,
    skinList = [],
    activeSkinName = "",
    onSelectSkin,
    onImportSkin,
    isImportingSkin = false,
    skinMessage,
    onClearData,
}) => {
    const [activeSection, setActiveSection] = useState<SectionKey>("audio");
    const [searchQuery, setSearchQuery] = useState("");
    const [rebindingKey, setRebindingKey] = useState<keyof SettingsState | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const audioSectionRef = useRef<HTMLDivElement>(null);
    const visualSectionRef = useRef<HTMLDivElement>(null);
    const inputSectionRef = useRef<HTMLDivElement>(null);
    const skinSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (rebindingKey) {
                e.preventDefault();
                e.stopPropagation();
                if (e.code === "Escape") {
                    setRebindingKey(null);
                    return;
                }
                onChange(rebindingKey, e.code as SettingsState[typeof rebindingKey]);
                setRebindingKey(null);
                return;
            }

            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
    }, [rebindingKey, onChange, onClose]);

    const scrollToSection = (section: SectionKey) => {
        setActiveSection(section);
        const refMap: Record<SectionKey, React.RefObject<HTMLDivElement | null>> = {
            audio: audioSectionRef,
            visual: visualSectionRef,
            input: inputSectionRef,
            skin: skinSectionRef,
        };

        const target = refMap[section]?.current;
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

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

    const q = searchQuery.toLowerCase().trim();
    const matches = (keywords: string[]) => {
        if (!q) return true;
        return keywords.some((kw) => kw.toLowerCase().includes(q));
    };

    const showAudio = matches(["audio", "volume", "sound", "music", "hitsound", "звук", "музыка", "громкость", "хитсаунд", "offset"]);
    const showVisual = matches(["visual", "graphic", "dim", "blur", "video", "lighting", "fps", "counter", "colour", "свет", "фон", "размытие", "затемнение", "фпс", "кадры"]);
    const showInput = matches(["input", "keyboard", "key", "bind", "left", "right", "dash", "speed", "click", "управление", "клавиши", "бинд", "стрелки"]);
    const showSkin = matches(["skin", "theme", "скин", "тема", "импорт"]);
    const showData = matches(["data", "clear", "storage", "reset", "очистить", "данные", "сброс"]);

    const handleClearData = async () => {
        if (onClearData) {
            onClearData();
            return;
        }

        if (!window.confirm("Are you sure you want to clear all data? This will permanently delete all imported beatmaps, custom skins, local scores, and saved settings.")) {
            return;
        }

        try {
            localStorage.clear();
        } catch (err) {
            void err;
        }

        try {
            if ("storage" in navigator && "getDirectory" in navigator.storage) {
                const root = await navigator.storage.getDirectory();
                try {
                    await root.removeEntry("beatmaps", { recursive: true });
                } catch (err) {
                    void err;
                }
                try {
                    await root.removeEntry("skins", { recursive: true });
                } catch (err) {
                    void err;
                }
            }
        } catch (err) {
            void err;
        }

        window.location.reload();
    };

    return (
        <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Settings Overlay">
            <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
                <nav className={styles.navRail} aria-label="Settings Navigation">
                    <button
                        type="button"
                        className={`${styles.navRailBtn} ${activeSection === "audio" ? styles.navRailBtnActive : ""}`}
                        onClick={() => scrollToSection("audio")}
                        title="Audio (Volume & Hitsounds)"
                        aria-label="Audio settings"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className={`${styles.navRailBtn} ${activeSection === "visual" ? styles.navRailBtnActive : ""}`}
                        onClick={() => scrollToSection("visual")}
                        title="Visual (Dim, Blur, Lighting)"
                        aria-label="Visual settings"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                        </svg>
                    </button>
                    <button
                        type="button"
                        className={`${styles.navRailBtn} ${activeSection === "input" ? styles.navRailBtnActive : ""}`}
                        onClick={() => scrollToSection("input")}
                        title="Input (Controls & Keybinds)"
                        aria-label="Input settings"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                            <line x1="6" y1="8" x2="6" y2="8"/>
                            <line x1="10" y1="8" x2="10" y2="8"/>
                            <line x1="14" y1="8" x2="14" y2="8"/>
                            <line x1="18" y1="8" x2="18" y2="8"/>
                            <line x1="6" y1="12" x2="6" y2="12"/>
                            <line x1="18" y1="12" x2="18" y2="12"/>
                            <line x1="7" y1="16" x2="17" y2="16"/>
                        </svg>
                    </button>
                    <button
                        type="button"
                        className={`${styles.navRailBtn} ${activeSection === "skin" ? styles.navRailBtnActive : ""}`}
                        onClick={() => scrollToSection("skin")}
                        title="Skin (Custom skins)"
                        aria-label="Skin settings"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                            <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
                            <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
                        </svg>
                    </button>
                </nav>

                <div className={styles.contentArea}>
                    <div className={styles.header}>
                        <div>
                            <h2 className={styles.headerTitle}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3"/>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                                </svg>
                                <span>SETTINGS</span>
                            </h2>
                            <p className={styles.headerSubtitle}>
                                Configure audio, graphics, custom keybinds and performance
                            </p>
                        </div>
                        <button
                            type="button"
                            className={styles.closeButton}
                            onClick={onClose}
                            title="Close settings (Esc)"
                            aria-label="Close settings"
                        >
                            ✕
                        </button>
                    </div>

                    <div className={styles.searchWrapper}>
                        <span className={styles.searchIcon}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </span>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Type to search settings (e.g. volume, keys, fps)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className={styles.searchClear}
                                onClick={() => setSearchQuery("")}
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className={styles.scrollContainer} ref={scrollContainerRef}>
                        <div className={styles.sectionCard}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionTitle}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    PLAYER PROFILE
                                </span>
                            </div>
                            <div className={styles.controlGroup}>
                                <div className={styles.labelRow}>
                                    <div className={styles.labelLeft}>
                                        <span className={styles.controlTitle}>Player Nickname</span>
                                    </div>
                                    <input
                                        type="text"
                                        style={{
                                            background: "rgba(255, 255, 255, 0.08)",
                                            border: "1px solid rgba(255, 255, 255, 0.2)",
                                            borderRadius: "6px",
                                            padding: "6px 12px",
                                            color: "#ffffff",
                                            fontSize: "13px",
                                            fontWeight: "700",
                                            outline: "none",
                                            width: "160px",
                                        }}
                                        value={settings.username ?? "ImNotTima"}
                                        onChange={(e) => onChange("username", e.target.value)}
                                        placeholder="Player name"
                                    />
                                </div>
                            </div>
                        </div>

                        {showAudio && (
                            <div className={styles.sectionCard} ref={audioSectionRef}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionTitle}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                        </svg>
                                        AUDIO SETTINGS
                                    </span>
                                </div>

                                <div className={styles.controlGroup}>
                                    <div className={styles.labelRow}>
                                        <div className={styles.labelLeft}>
                                            <button
                                                type="button"
                                                className={`${styles.resetBtn} ${settings.masterVolume !== DEFAULT_SETTINGS.masterVolume ? styles.resetBtnModified : ""}`}
                                                onClick={() => onReset("masterVolume")}
                                                title="Reset to default (100%)"
                                            >
                                                ↺
                                            </button>
                                            <span className={styles.controlLabel}>Master volume</span>
                                        </div>
                                        <span className={styles.valueBadge}>{settings.masterVolume}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={settings.masterVolume}
                                        className={styles.slider}
                                        style={{ "--progress": `${settings.masterVolume}%` } as React.CSSProperties}
                                        onChange={(e) => onChange("masterVolume", Number(e.target.value))}
                                    />
                                </div>

                                <div className={styles.controlGroup}>
                                    <div className={styles.labelRow}>
                                        <div className={styles.labelLeft}>
                                            <button
                                                type="button"
                                                className={`${styles.resetBtn} ${settings.musicVolume !== DEFAULT_SETTINGS.musicVolume ? styles.resetBtnModified : ""}`}
                                                onClick={() => onReset("musicVolume")}
                                                title="Reset to default (80%)"
                                            >
                                                ↺
                                            </button>
                                            <span className={styles.controlLabel}>Music volume</span>
                                        </div>
                                        <span className={styles.valueBadge}>{settings.musicVolume}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={settings.musicVolume}
                                        className={styles.slider}
                                        style={{ "--progress": `${settings.musicVolume}%` } as React.CSSProperties}
                                        onChange={(e) => onChange("musicVolume", Number(e.target.value))}
                                    />
                                </div>

                                <div className={styles.controlGroup}>
                                    <div className={styles.labelRow}>
                                        <div className={styles.labelLeft}>
                                            <button
                                                type="button"
                                                className={`${styles.resetBtn} ${settings.hitsoundVolume !== DEFAULT_SETTINGS.hitsoundVolume ? styles.resetBtnModified : ""}`}
                                                onClick={() => onReset("hitsoundVolume")}
                                                title="Reset to default (80%)"
                                            >
                                                ↺
                                            </button>
                                            <span className={styles.controlLabel}>Hitsound volume</span>
                                        </div>
                                        <span className={styles.valueBadge}>{settings.hitsoundVolume}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={settings.hitsoundVolume}
                                        className={styles.slider}
                                        style={{ "--progress": `${settings.hitsoundVolume}%` } as React.CSSProperties}
                                        onChange={(e) => onChange("hitsoundVolume", Number(e.target.value))}
                                    />
                                </div>

                                <div className={styles.toggleRow}>
                                    <div className={styles.labelLeft}>
                                        <button
                                            type="button"
                                            className={`${styles.resetBtn} ${settings.beatmapHitsounds !== DEFAULT_SETTINGS.beatmapHitsounds ? styles.resetBtnModified : ""}`}
                                            onClick={() => onReset("beatmapHitsounds")}
                                            title="Reset to default"
                                        >
                                            ↺
                                        </button>
                                        <span className={styles.controlLabel}>Beatmap hitsounds</span>
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
                                        <div className={styles.labelLeft}>
                                            <button
                                                type="button"
                                                className={`${styles.resetBtn} ${settings.audioOffset !== DEFAULT_SETTINGS.audioOffset ? styles.resetBtnModified : ""}`}
                                                onClick={() => onReset("audioOffset")}
                                                title="Reset to 0ms"
                                            >
                                                ↺
                                            </button>
                                            <span className={styles.controlLabel}>Universal audio offset</span>
                                        </div>
                                        <span className={styles.valueBadge}>
                                            {settings.audioOffset > 0 ? `+${settings.audioOffset}ms` : `${settings.audioOffset}ms`}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-100"
                                        max="100"
                                        value={settings.audioOffset}
                                        className={styles.slider}
                                        style={{ "--progress": `${((settings.audioOffset + 100) / 200) * 100}%` } as React.CSSProperties}
                                        onChange={(e) => onChange("audioOffset", Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        )}

                        {showVisual && (
                            <div className={styles.sectionCard} ref={visualSectionRef}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionTitle}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                                            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                                            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                                            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                                        </svg>
                                        GRAPHICS & VISUALS
                                    </span>
                                </div>

                                <div className={styles.controlGroup}>
                                    <div className={styles.labelRow}>
                                        <div className={styles.labelLeft}>
                                            <button
                                                type="button"
                                                className={`${styles.resetBtn} ${settings.backgroundDim !== DEFAULT_SETTINGS.backgroundDim ? styles.resetBtnModified : ""}`}
                                                onClick={() => onReset("backgroundDim")}
                                                title="Reset to default (75%)"
                                            >
                                                ↺
                                            </button>
                                            <span className={styles.controlLabel}>Background dim</span>
                                        </div>
                                        <span className={styles.valueBadge}>{settings.backgroundDim}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={settings.backgroundDim}
                                        className={styles.slider}
                                        style={{ "--progress": `${settings.backgroundDim}%` } as React.CSSProperties}
                                        onChange={(e) => onChange("backgroundDim", Number(e.target.value))}
                                    />
                                </div>

                                <div className={styles.controlGroup}>
                                    <div className={styles.labelRow}>
                                        <div className={styles.labelLeft}>
                                            <button
                                                type="button"
                                                className={`${styles.resetBtn} ${settings.backgroundBlur !== DEFAULT_SETTINGS.backgroundBlur ? styles.resetBtnModified : ""}`}
                                                onClick={() => onReset("backgroundBlur")}
                                                title="Reset to default (0%)"
                                            >
                                                ↺
                                            </button>
                                            <span className={styles.controlLabel}>Background blur</span>
                                        </div>
                                        <span className={styles.valueBadge}>{settings.backgroundBlur}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={settings.backgroundBlur}
                                        className={styles.slider}
                                        style={{ "--progress": `${settings.backgroundBlur}%` } as React.CSSProperties}
                                        onChange={(e) => onChange("backgroundBlur", Number(e.target.value))}
                                    />
                                </div>

                                <div className={styles.toggleRow}>
                                    <div className={styles.labelLeft}>
                                        <button
                                            type="button"
                                            className={`${styles.resetBtn} ${settings.hitLighting !== DEFAULT_SETTINGS.hitLighting ? styles.resetBtnModified : ""}`}
                                            onClick={() => onReset("hitLighting")}
                                            title="Reset to default"
                                        >
                                            ↺
                                        </button>
                                        <span className={styles.controlLabel}>Hit lighting (osu!lazer fountain)</span>
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

                                <div className={styles.toggleRow}>
                                    <div className={styles.labelLeft}>
                                        <button
                                            type="button"
                                            className={`${styles.resetBtn} ${settings.storyboardVideo !== DEFAULT_SETTINGS.storyboardVideo ? styles.resetBtnModified : ""}`}
                                            onClick={() => onReset("storyboardVideo")}
                                            title="Reset to default"
                                        >
                                            ↺
                                        </button>
                                        <span className={styles.controlLabel}>Storyboard / video</span>
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

                                <div className={styles.toggleRow}>
                                    <div className={styles.labelLeft}>
                                        <button
                                            type="button"
                                            className={`${styles.resetBtn} ${settings.beatmapSkins !== DEFAULT_SETTINGS.beatmapSkins ? styles.resetBtnModified : ""}`}
                                            onClick={() => onReset("beatmapSkins")}
                                            title="Reset to default"
                                        >
                                            ↺
                                        </button>
                                        <span className={styles.controlLabel}>Beatmap skins</span>
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

                                <div className={styles.toggleRow}>
                                    <div className={styles.labelLeft}>
                                        <button
                                            type="button"
                                            className={`${styles.resetBtn} ${settings.beatmapColours !== DEFAULT_SETTINGS.beatmapColours ? styles.resetBtnModified : ""}`}
                                            onClick={() => onReset("beatmapColours")}
                                            title="Reset to default"
                                        >
                                            ↺
                                        </button>
                                        <span className={styles.controlLabel}>Beatmap colours</span>
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
                                        <div className={styles.labelLeft}>
                                            <button
                                                type="button"
                                                className={`${styles.resetBtn} ${settings.comboColourNormalisation !== DEFAULT_SETTINGS.comboColourNormalisation ? styles.resetBtnModified : ""}`}
                                                onClick={() => onReset("comboColourNormalisation")}
                                                title="Reset to default (45%)"
                                            >
                                                ↺
                                            </button>
                                            <span className={styles.controlLabel}>Combo colour normalisation</span>
                                        </div>
                                        <span className={styles.valueBadge}>{settings.comboColourNormalisation}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={settings.comboColourNormalisation}
                                        className={styles.slider}
                                        style={{ "--progress": `${settings.comboColourNormalisation}%` } as React.CSSProperties}
                                        onChange={(e) => onChange("comboColourNormalisation", Number(e.target.value))}
                                    />
                                </div>

                                <div className={styles.toggleRow}>
                                    <div className={styles.labelLeft}>
                                        <button
                                            type="button"
                                            className={`${styles.resetBtn} ${settings.showFpsCounter !== DEFAULT_SETTINGS.showFpsCounter ? styles.resetBtnModified : ""}`}
                                            onClick={() => onReset("showFpsCounter")}
                                            title="Reset to default"
                                        >
                                            ↺
                                        </button>
                                        <span className={styles.controlLabel}>Show FPS counter (Ctrl+F11)</span>
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
                        )}

                        {showInput && (
                            <div className={styles.sectionCard} ref={inputSectionRef}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionTitle}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                                            <line x1="6" y1="8" x2="6" y2="8"/>
                                            <line x1="10" y1="8" x2="10" y2="8"/>
                                            <line x1="14" y1="8" x2="14" y2="8"/>
                                            <line x1="18" y1="8" x2="18" y2="8"/>
                                            <line x1="6" y1="12" x2="6" y2="12"/>
                                            <line x1="18" y1="12" x2="18" y2="12"/>
                                            <line x1="7" y1="16" x2="17" y2="16"/>
                                        </svg>
                                        INPUT & CONTROLS
                                    </span>
                                    {hasCustomKeys && (
                                        <button
                                            type="button"
                                            className={styles.resetBtnModified}
                                            style={{ background: "transparent", border: "none", fontSize: "11px", cursor: "pointer" }}
                                            onClick={handleResetKeys}
                                            title="Reset keys to default"
                                        >
                                            Reset keys ↺
                                        </button>
                                    )}
                                </div>

                                <div className={styles.keybindRow}>
                                    <span className={styles.keybindLabel}>Move Left</span>
                                    <div className={styles.keybindActions}>
                                        <button
                                            type="button"
                                            className={`${styles.keybindKey} ${rebindingKey === "leftKey1" ? styles.keybindKeyRebinding : ""}`}
                                            onClick={() => setRebindingKey(rebindingKey === "leftKey1" ? null : "leftKey1")}
                                            title="Click to rebind Left Key 1"
                                        >
                                            {rebindingKey === "leftKey1" ? "..." : formatKeyName(settings.leftKey1)}
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.keybindKey} ${rebindingKey === "leftKey2" ? styles.keybindKeyRebinding : ""}`}
                                            onClick={() => setRebindingKey(rebindingKey === "leftKey2" ? null : "leftKey2")}
                                            title="Click to rebind Left Key 2"
                                        >
                                            {rebindingKey === "leftKey2" ? "..." : formatKeyName(settings.leftKey2)}
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.keybindRow}>
                                    <span className={styles.keybindLabel}>Move Right</span>
                                    <div className={styles.keybindActions}>
                                        <button
                                            type="button"
                                            className={`${styles.keybindKey} ${rebindingKey === "rightKey1" ? styles.keybindKeyRebinding : ""}`}
                                            onClick={() => setRebindingKey(rebindingKey === "rightKey1" ? null : "rightKey1")}
                                            title="Click to rebind Right Key 1"
                                        >
                                            {rebindingKey === "rightKey1" ? "..." : formatKeyName(settings.rightKey1)}
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.keybindKey} ${rebindingKey === "rightKey2" ? styles.keybindKeyRebinding : ""}`}
                                            onClick={() => setRebindingKey(rebindingKey === "rightKey2" ? null : "rightKey2")}
                                            title="Click to rebind Right Key 2"
                                        >
                                            {rebindingKey === "rightKey2" ? "..." : formatKeyName(settings.rightKey2)}
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.keybindRow}>
                                    <span className={styles.keybindLabel}>Dash (Speed Boost)</span>
                                    <div className={styles.keybindActions}>
                                        <button
                                            type="button"
                                            className={`${styles.keybindKey} ${rebindingKey === "dashKey1" ? styles.keybindKeyRebinding : ""}`}
                                            onClick={() => setRebindingKey(rebindingKey === "dashKey1" ? null : "dashKey1")}
                                            title="Click to rebind Dash Key 1"
                                        >
                                            {rebindingKey === "dashKey1" ? "..." : formatKeyName(settings.dashKey1)}
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.keybindKey} ${rebindingKey === "dashKey2" ? styles.keybindKeyRebinding : ""}`}
                                            onClick={() => setRebindingKey(rebindingKey === "dashKey2" ? null : "dashKey2")}
                                            title="Click to rebind Dash Key 2"
                                        >
                                            {rebindingKey === "dashKey2" ? "..." : formatKeyName(settings.dashKey2)}
                                        </button>
                                    </div>
                                </div>

                                {rebindingKey && (
                                    <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#ffd633", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="4" width="20" height="16" rx="2"/>
                                            <line x1="6" y1="8" x2="6" y2="8"/>
                                            <line x1="10" y1="8" x2="10" y2="8"/>
                                            <line x1="14" y1="8" x2="14" y2="8"/>
                                            <line x1="18" y1="8" x2="18" y2="8"/>
                                            <line x1="6" y1="12" x2="6" y2="12"/>
                                            <line x1="18" y1="12" x2="18" y2="12"/>
                                            <line x1="7" y1="16" x2="17" y2="16"/>
                                        </svg>
                                        <span>Press any key on your keyboard to bind (or Esc to cancel)</span>
                                    </p>
                                )}

                                <div className={styles.toggleRow}>
                                    <div className={styles.labelLeft}>
                                        <button
                                            type="button"
                                            className={`${styles.resetBtn} ${settings.disableClicks !== DEFAULT_SETTINGS.disableClicks ? styles.resetBtnModified : ""}`}
                                            onClick={() => onReset("disableClicks")}
                                            title="Reset to default"
                                        >
                                            ↺
                                        </button>
                                        <span className={styles.controlLabel}>Disable mouse buttons during play</span>
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
                        )}

                        {showSkin && (
                            <div className={styles.sectionCard} ref={skinSectionRef}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionTitle}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
                                            <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
                                            <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
                                        </svg>
                                        SKIN MANAGEMENT
                                    </span>
                                </div>

                                <div className={styles.controlGroup}>
                                    <span className={styles.controlLabel}>Active Skin</span>
                                    <select
                                        className={styles.skinSelect}
                                        value={activeSkinName}
                                        onChange={(e) => onSelectSkin?.(e.target.value)}
                                    >
                                        <option value="">Default (osu! Catch)</option>
                                        {skinList.map((name) => (
                                             <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                {onImportSkin && (
                                    <div>
                                        <button
                                            type="button"
                                            className={styles.skinImportBtn}
                                            onClick={onImportSkin}
                                            disabled={isImportingSkin}
                                        >
                                            {isImportingSkin ? (
                                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                                                    </svg>
                                                    Importing...
                                                </span>
                                            ) : (
                                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                        <polyline points="17 8 12 3 7 8" />
                                                        <line x1="12" y1="3" x2="12" y2="15" />
                                                    </svg>
                                                    Import skin (.osk / archive)
                                                </span>
                                            )}
                                        </button>
                                        {skinMessage && (
                                            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#ffd633" }}>
                                                {skinMessage}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {showData && (
                            <div className={styles.sectionCard}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionTitle}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18"/>
                                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                            <line x1="10" y1="11" x2="10" y2="17"/>
                                            <line x1="14" y1="11" x2="14" y2="17"/>
                                        </svg>
                                        DATA & STORAGE
                                    </span>
                                </div>

                                <div className={styles.controlGroup}>
                                    <div className={styles.labelRow}>
                                        <div className={styles.labelLeft}>
                                            <span className={styles.controlLabel}>Clear all game data</span>
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.dangerBtn}
                                            onClick={handleClearData}
                                            title="Delete all beatmaps, skins, scores, and reset settings"
                                        >
                                            Clear data
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={styles.footer}>
                            <button
                                type="button"
                                className={styles.resetAllBtn}
                                onClick={onResetAll}
                                title="Reset all settings to default values"
                            >
                                Reset all settings to defaults
                            </button>
                            <button
                                type="button"
                                className={styles.clearDataBtn}
                                onClick={handleClearData}
                                title="Clear all stored data (beatmaps, skins, scores, settings)"
                            >
                                Clear all data
                            </button>
                            <span style={{ fontSize: "11px", color: "#6e6e82" }}>
                                Press Esc or Ctrl+O to close
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MainMenuSettings;
