import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import type { CatchBeatmap } from "osu-catch-stable";
import { getImportedSkin, importSkinArchive, importSkinFile } from "../files/skin/skinImporter";
import {
    getImportedBeatmapSet,
    importBeatmapArchive,
    importBeatmapFile,
    getBeatmapBackgroundPath,
    getImportedBeatmapFile,
    type BeatmapSet,
    type BeatmapDifficulty,
} from "../files/beatmap/beatmapImporter";
import { useSkin } from "../contexts/skinContextValue";
import { useBeatmap } from "../contexts/beatmapContextValue";
import { EnumDir } from "../files/shared";
import MainMenuSettings from "./MainMenuSettings";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type SettingsState } from "../gameplay/settingsTypes";
import {
    getLocalScores,
    getBestScore,
    deleteLocalScore,
    getBeatmapPlayCount,
    isBeatmapFavorite,
    toggleBeatmapFavorite,
    formatTimeAgo,
    type LocalScoreRecord,
} from "../gameplay/localScores";
import {
    fetchBeatmapOnlineDetails,
    formatTimeAgo as formatRelativeDate,
    type BeatmapOnlineDetails,
} from "../gameplay/beatmapOnlineInfo";
import sampleOszUrl from "../assets/uwagaki.osz?url";
import styles from "./MainMenu.module.css";

interface MainMenuProps {
    onPlay(): void;
}

interface Toast {
    id: number;
    message: string;
    type: "success" | "error";
}

function sortNames(names: string[]): string[] {
    return [...new Set(names)].sort((left, right) => left.localeCompare(right));
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

function getGradeBadgeClass(grade: string): string {
    switch (grade) {
        case "SS": return styles.gradeSS;
        case "S": return styles.gradeS;
        case "A": return styles.gradeA;
        case "B": return styles.gradeB;
        case "C": return styles.gradeC;
        case "D": return styles.gradeD;
        default: return styles.gradeS;
    }
}

function getBeatmapDurationFormatted(parsed?: CatchBeatmap): string {
    if (!parsed || !parsed.hitObjects || parsed.hitObjects.length === 0) return "00:00";
    const start = parsed.hitObjects[0]?.startTime ?? 0;
    const lastObj = parsed.hitObjects[parsed.hitObjects.length - 1];
    const end = (lastObj as { endTime?: number })?.endTime ?? lastObj?.startTime ?? 0;
    const durationSec = Math.max(0, Math.round((end - start) / 1000));
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getBeatmapBpm(parsed?: CatchBeatmap): number {
    if (!parsed || !parsed.controlPoints?.timingPoints?.length) return 120;
    const firstTiming = parsed.controlPoints.timingPoints[0];
    return Math.round(firstTiming.bpm || (firstTiming.beatLength ? 60000 / firstTiming.beatLength : 120));
}

function getCatchCounts(parsed?: CatchBeatmap) {
    if (!parsed) {
        return { fruits: 0, juiceStreams: 0, bananaShowers: 0 };
    }
    return {
        fruits: parsed.fruits?.length ?? 0,
        juiceStreams: parsed.juiceStreams?.length ?? 0,
        bananaShowers: parsed.bananaShowers?.length ?? 0,
    };
}

function useSystemClock(): string {
    const [timeStr, setTimeStr] = useState(() => {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    });

    useEffect(() => {
        const interval = setInterval(() => {
            const d = new Date();
            setTimeStr(d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return timeStr;
}

export default function MainMenu({ onPlay }: MainMenuProps) {
    const [view, setView] = useState<"home" | "songSelect">("home");
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<SettingsState>(() => loadSettings());
    const [isImportingSkin, setIsImportingSkin] = useState(false);
    const [isBeatmapBusy, setIsBeatmapBusy] = useState(false);
    const [skinList, setSkinList] = useState<string[]>([]);
    const [, setBeatmapList] = useState<string[]>([]);
    const [loadedSets, setLoadedSets] = useState<BeatmapSet[]>([]);
    const [bgThumbnails, setBgThumbnails] = useState<Map<string, string>>(new Map());
    const [backgroundUrl, setBackgroundUrl] = useState<string>();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"ranking" | "details">("ranking");
    const [sortMode, setSortMode] = useState<"lastPlayed" | "title" | "artist" | "stars">("lastPlayed");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const [scoreVersion, setScoreVersion] = useState(0);
    const [favoriteVersion, setFavoriteVersion] = useState(0);

    const currentTime = useSystemClock();

    const { activeSkin, isReady, setActiveSkin } = useSkin();
    const {
        selectedSet,
        selectedDifficulty,
        selectSet,
        selectDifficulty,
    } = useBeatmap();

    const searchInputRef = useRef<HTMLInputElement>(null);

    const addToast = useCallback((message: string, type: "success" | "error" = "success") => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4500);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const refreshBeatmapSets = useCallback(async (names: string[]): Promise<BeatmapSet[]> => {
        const sets: BeatmapSet[] = [];
        for (const name of names) {
            try {
                const s = await getImportedBeatmapSet(name);
                if (s) sets.push(s);
            } catch (err) {
                console.warn(`Failed to read beatmap set ${name}:`, err);
            }
        }
        setLoadedSets(sets);

        for (const s of sets) {
            const firstDiff = s.difficulties[0];
            if (!firstDiff) continue;
            const bgFilename = getBeatmapBackgroundPath(firstDiff.parsed);
            if (!bgFilename) continue;

            void getImportedBeatmapFile(s.id, firstDiff.path, bgFilename)
                .then((file) => {
                    const url = URL.createObjectURL(file);
                    setBgThumbnails((prev) => {
                        const next = new Map(prev);
                        next.set(s.id, url);
                        return next;
                    });
                })
                .catch(() => undefined);
        }

        return sets;
    }, []);

    useEffect(() => {
        let cancelled = false;

        void EnumDir("skins").then((names) => {
            if (!cancelled) setSkinList(sortNames(names));
        }).catch((error) => {
            if (!cancelled) console.error("Failed to load skins", error);
        });

        void EnumDir("beatmaps").then(async (names) => {
            if (cancelled) return;
            const sorted = sortNames(names);
            setBeatmapList(sorted);

            const sets = await refreshBeatmapSets(sorted);
            if (cancelled) return;

            if (!selectedSet && sets.length > 0) {
                selectSet(sets[0]);
                if (sets[0].difficulties.length > 0) {
                    const preferredDiff = sets[0].difficulties.find((d) => d.versionName.includes("Platter"))
                        ?? sets[0].difficulties[0];
                    selectDifficulty(preferredDiff.id);
                }
            }
        }).catch((error) => {
            if (!cancelled) console.error("Failed to load beatmaps", error);
        });

        return () => {
            cancelled = true;
        };
    }, [refreshBeatmapSets, selectSet, selectDifficulty, selectedSet]);

    useEffect(() => {
        let cancelled = false;
        let createdUrl: string | undefined;

        void Promise.resolve().then(async () => {
            if (cancelled) return;

            if (!selectedSet || !selectedDifficulty) {
                setBackgroundUrl(undefined);
                return;
            }

            const bgFilename = getBeatmapBackgroundPath(selectedDifficulty.parsed);
            if (!bgFilename) {
                setBackgroundUrl(undefined);
                return;
            }

            try {
                const file = await getImportedBeatmapFile(selectedSet.id, selectedDifficulty.path, bgFilename);
                if (cancelled) return;
                createdUrl = URL.createObjectURL(file);
                setBackgroundUrl(createdUrl);
            } catch (err) {
                console.warn("Failed to load background artwork:", err);
                if (!cancelled) setBackgroundUrl(undefined);
            }
        });

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [selectedSet, selectedDifficulty]);

    const handleSkinImport = useCallback(async (file?: File): Promise<void> => {
        setIsImportingSkin(true);

        try {
            const skin = file ? await importSkinFile(file) : await importSkinArchive();
            setActiveSkin(skin);
            setSkinList((current) => sortNames([...current, skin.name]));
            addToast(`Imported skin: ${skin.name}`, "success");
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            console.error("Failed to import skin", error);
            addToast("Failed to import skin", "error");
        } finally {
            setIsImportingSkin(false);
        }
    }, [addToast, setActiveSkin]);

    async function handleSkinSelection(name: string): Promise<void> {
        if (!name) {
            setActiveSkin(undefined);
            return;
        }

        try {
            const skin = await getImportedSkin(name);
            if (!skin) {
                setActiveSkin(undefined);
                setSkinList((current) => current.filter((item) => item !== name));
                addToast(`Skin not found: ${name}`, "error");
                return;
            }
            setActiveSkin(skin);
        } catch (error) {
            console.error("Failed to select skin", error);
            addToast("Failed to select skin", "error");
        }
    }

    const handleBeatmapImport = useCallback(async (file?: File): Promise<void> => {
        setIsBeatmapBusy(true);

        try {
            const beatmapSet = file ? await importBeatmapFile(file) : await importBeatmapArchive();
            selectSet(beatmapSet);
            if (beatmapSet.difficulties.length > 0) {
                selectDifficulty(beatmapSet.difficulties[0].id);
            }
            setBeatmapList((prev) => {
                const next = sortNames([...prev, beatmapSet.id]);
                void refreshBeatmapSets(next);
                return next;
            });
            addToast(`Imported beatmap: ${beatmapSet.artist} – ${beatmapSet.title}`, "success");
            setView("songSelect");
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            console.error("Failed to import beatmap", error);
            addToast("Failed to import beatmap", "error");
        } finally {
            setIsBeatmapBusy(false);
        }
    }, [addToast, refreshBeatmapSets, selectDifficulty, selectSet]);

    async function handleLoadSampleBeatmap(): Promise<void> {
        setIsBeatmapBusy(true);

        try {
            const res = await fetch(sampleOszUrl);
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const blob = await res.blob();
            const file = new File([blob], "uwagaki.osz", { type: "application/octet-stream" });
            const beatmapSet = await importBeatmapFile(file);
            selectSet(beatmapSet);
            if (beatmapSet.difficulties.length > 0) {
                const preferred = beatmapSet.difficulties.find((d) => d.versionName.includes("Platter"))
                    ?? beatmapSet.difficulties[0];
                selectDifficulty(preferred.id);
            }
            setBeatmapList((prev) => {
                const next = sortNames([...prev, beatmapSet.id]);
                void refreshBeatmapSets(next);
                return next;
            });
            addToast(`Loaded sample beatmap: ${beatmapSet.title}`, "success");
            setView("songSelect");
        } catch (error) {
            console.error("Failed to load sample beatmap", error);
            addToast("Could not load sample beatmap", "error");
        } finally {
            setIsBeatmapBusy(false);
        }
    }

    const handleOpenSettings = () => {
        setSettings(loadSettings());
        setShowSettings(true);
    };

    const handleSettingChange = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setSettings((prev) => {
            const updated = { ...prev, [key]: value };
            saveSettings(updated);
            return updated;
        });
    }, []);

    const handleSettingReset = useCallback(<K extends keyof SettingsState>(key: K) => {
        setSettings((prev) => {
            const updated = { ...prev, [key]: DEFAULT_SETTINGS[key] };
            saveSettings(updated);
            return updated;
        });
    }, []);

    const handleResetAll = useCallback(() => {
        if (window.confirm("Reset all settings to default values?")) {
            setSettings(DEFAULT_SETTINGS);
            saveSettings(DEFAULT_SETTINGS);
        }
    }, []);

    const filteredSets = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let list = loadedSets;

        if (q) {
            list = list.filter((s) => (
                s.title.toLowerCase().includes(q)
                || s.artist.toLowerCase().includes(q)
                || s.creator.toLowerCase().includes(q)
                || s.difficulties.some((d) => d.versionName.toLowerCase().includes(q))
            ));
        }

        const sorted = [...list];
        if (sortMode === "title") {
            sorted.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortMode === "artist") {
            sorted.sort((a, b) => a.artist.localeCompare(b.artist));
        } else if (sortMode === "stars") {
            sorted.sort((a, b) => {
                const maxA = Math.max(...a.difficulties.map((d) => d.starRating ?? 0), 0);
                const maxB = Math.max(...b.difficulties.map((d) => d.starRating ?? 0), 0);
                return maxB - maxA;
            });
        }
        return sorted;
    }, [loadedSets, searchQuery, sortMode]);

    const handleRandomSelect = useCallback(() => {
        if (filteredSets.length === 0) return;
        const randSetIndex = Math.floor(Math.random() * filteredSets.length);
        const randSet = filteredSets[randSetIndex];
        selectSet(randSet);
        if (randSet.difficulties.length > 0) {
            const randDiffIndex = Math.floor(Math.random() * randSet.difficulties.length);
            selectDifficulty(randSet.difficulties[randDiffIndex].id);
        }
    }, [filteredSets, selectDifficulty, selectSet]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.code === "KeyO") {
                e.preventDefault();
                setShowSettings((prev) => !prev);
                return;
            }

            if (showSettings) return;

            if (e.code === "Escape") {
                if (view === "songSelect") {
                    e.preventDefault();
                    setView("home");
                }
                return;
            }

            if (view === "home") {
                if (e.code === "KeyP" || e.code === "Enter") {
                    e.preventDefault();
                    setView("songSelect");
                }
                return;
            }

            if (view === "songSelect") {
                if (e.code === "F2") {
                    e.preventDefault();
                    handleRandomSelect();
                    return;
                }

                if (e.code === "Enter" && !isBeatmapBusy && selectedDifficulty) {
                    e.preventDefault();
                    onPlay();
                    return;
                }

                if (e.code === "ArrowDown" || e.code === "ArrowUp") {
                    if (document.activeElement === searchInputRef.current) return;
                    e.preventDefault();
                    const currentIndex = filteredSets.findIndex((s) => s.id === selectedSet?.id);
                    const nextIndex = e.code === "ArrowDown"
                        ? Math.min(filteredSets.length - 1, currentIndex + 1)
                        : Math.max(0, currentIndex - 1);

                    if (nextIndex >= 0 && nextIndex < filteredSets.length && nextIndex !== currentIndex) {
                        const targetSet = filteredSets[nextIndex];
                        selectSet(targetSet);
                        if (targetSet.difficulties.length > 0) {
                            selectDifficulty(targetSet.difficulties[0].id);
                        }
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [view, showSettings, isBeatmapBusy, selectedDifficulty, onPlay, filteredSets, selectedSet, selectSet, selectDifficulty, handleRandomSelect]);

    useEffect(() => {
        let dragCounter = 0;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter++;
            if (e.dataTransfer?.types.includes("Files")) setIsDraggingOver(true);
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                setIsDraggingOver(false);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            dragCounter = 0;
            setIsDraggingOver(false);

            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const name = file.name.toLowerCase();
                if (name.endsWith(".osz")) {
                    void handleBeatmapImport(file);
                } else if (name.endsWith(".osk")) {
                    void handleSkinImport(file);
                } else {
                    addToast(`Unsupported file: ${file.name}. Drop .osz or .osk archives.`, "error");
                }
            }
        };

        window.addEventListener("dragenter", handleDragEnter);
        window.addEventListener("dragleave", handleDragLeave);
        window.addEventListener("dragover", handleDragOver);
        window.addEventListener("drop", handleDrop);

        return () => {
            window.removeEventListener("dragenter", handleDragEnter);
            window.removeEventListener("dragleave", handleDragLeave);
            window.removeEventListener("dragover", handleDragOver);
            window.removeEventListener("drop", handleDrop);
        };
    }, [addToast, handleBeatmapImport, handleSkinImport]);

    const skinControlsDisabled = !isReady || isImportingSkin;
    const canPlay = !skinControlsDisabled && !isBeatmapBusy && Boolean(selectedDifficulty);

    const diffParsed = selectedDifficulty?.parsed;
    const starRating = selectedDifficulty?.starRating;
    const starColor = getStarRatingColor(starRating);

    const catchCounts = useMemo(() => getCatchCounts(diffParsed), [diffParsed]);
    const durationFormatted = useMemo(() => getBeatmapDurationFormatted(diffParsed), [diffParsed]);
    const bpm = useMemo(() => getBeatmapBpm(diffParsed), [diffParsed]);

    const [onlineDetails, setOnlineDetails] = useState<BeatmapOnlineDetails | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const onlineBeatmapId = (diffParsed?.metadata as { beatmapId?: number } | undefined)?.beatmapId;

    useEffect(() => {
        let cancelled = false;
        if (!onlineBeatmapId || onlineBeatmapId <= 0) return;

        void Promise.resolve().then(async () => {
            if (cancelled) return;
            setIsLoadingDetails(true);
            try {
                const data = await fetchBeatmapOnlineDetails(onlineBeatmapId);
                if (!cancelled) {
                    setOnlineDetails(data);
                    setIsLoadingDetails(false);
                }
            } catch {
                if (!cancelled) {
                    setOnlineDetails(null);
                    setIsLoadingDetails(false);
                }
            }
        });

        return () => {
            cancelled = true;
        };
    }, [onlineBeatmapId]);

    const localScores: LocalScoreRecord[] = useMemo(() => {
        if (!selectedSet || !selectedDifficulty) return [];
        return scoreVersion >= 0 ? getLocalScores(selectedSet.id, selectedDifficulty.id) : [];
    }, [selectedSet, selectedDifficulty, scoreVersion]);

    const playCount = useMemo(() => {
        if (!selectedSet || !selectedDifficulty) return 0;
        return scoreVersion >= 0 ? getBeatmapPlayCount(selectedSet.id, selectedDifficulty.id) : 0;
    }, [selectedSet, selectedDifficulty, scoreVersion]);

    const isFavorite = useMemo(() => {
        if (!selectedSet) return false;
        return favoriteVersion >= 0 ? isBeatmapFavorite(selectedSet.id) : false;
    }, [selectedSet, favoriteVersion]);

    const handleToggleFavorite = () => {
        if (!selectedSet) return;
        const nowFav = toggleBeatmapFavorite(selectedSet.id);
        setFavoriteVersion((v) => v + 1);
        addToast(nowFav ? "Added to favorites" : "Removed from favorites", "success");
    };

    const handleDeleteScore = (scoreId: string) => {
        if (!selectedSet || !selectedDifficulty) return;
        deleteLocalScore(selectedSet.id, selectedDifficulty.id, scoreId);
        setScoreVersion((v) => v + 1);
        addToast("Score removed from local leaderboard", "success");
    };

    return (
        <div className={styles.mainMenu}>
            {backgroundUrl && (
                <div
                    className={styles.bgBackdrop}
                    style={{ backgroundImage: `url(${backgroundUrl})` }}
                />
            )}
            <div className={styles.ambientGlow} />
            <div className={styles.vignette} />
            <header className={styles.lazerTopBar}>
                <div className={styles.topBarLeft}>
                    {view === "songSelect" && (
                        <button
                            type="button"
                            className={styles.topBarIconBtn}
                            onClick={() => setView("home")}
                            title="Back to Main Menu (Esc)"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.topBarIconBtn}
                        onClick={handleOpenSettings}
                        title="Settings (Ctrl+O)"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                </div>

                <div className={styles.topBarRight}>
                    <div className={styles.userProfile} onClick={handleOpenSettings} title="Click to edit profile in Settings">
                        <div className={styles.userAvatar}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        </div>
                        <span className={styles.userName}>{settings.username || "Player"}</span>
                    </div>

                    <div className={styles.systemClock}>
                        {currentTime}
                    </div>
                </div>
            </header>
            {view === "home" && (
                <main className={styles.homeContainer}>
                    <div
                        className={styles.homeLogoLabel}
                        onClick={() => setView("songSelect")}
                        title="Click to Play"
                        role="button"
                        tabIndex={0}
                    >
                        webcatcher
                    </div>

                    <div className={styles.homeMenuStack}>
                        <button
                            type="button"
                            className={styles.homePlayBtn}
                            onClick={() => setView("songSelect")}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="6 3 20 12 6 21 6 3" />
                            </svg>
                            <span>PLAY</span>
                        </button>

                        <button
                            type="button"
                            className={styles.homeSettingsBtn}
                            onClick={handleOpenSettings}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            <span>SETTINGS</span>
                        </button>
                    </div>
                </main>
            )}
            {view === "songSelect" && (
                <div className={styles.songSelectLayout}>
                    <div className={styles.leftShowcasePanel}>
                        {selectedSet && selectedDifficulty ? (
                            <>
                                <div className={styles.showcaseHeader}>
                                    <div className={styles.rankedBadge}>
                                        {onlineDetails?.status ? onlineDetails.status.toUpperCase() : "RANKED"}
                                    </div>
                                    <h1 className={styles.songTitleBig} title={selectedSet.title}>
                                        {selectedSet.title}
                                    </h1>
                                    <div className={styles.songArtistSub} title={selectedSet.artist}>
                                        {selectedSet.artist}
                                    </div>

                                    <div className={styles.songMetaChipsRow}>
                                        <div className={styles.metaChip} title="Play Count">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <polygon points="5 3 19 12 5 21 5 3" />
                                            </svg>
                                            <span>{onlineDetails?.playcount ? onlineDetails.playcount.toLocaleString() : playCount}</span>
                                        </div>

                                        <button
                                            type="button"
                                            className={`${styles.favoriteHeartBtn} ${isFavorite ? styles.favoriteHeartActive : ""}`}
                                            onClick={handleToggleFavorite}
                                            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill={isFavorite ? "#ff4081" : "none"} stroke="currentColor" strokeWidth="2.5">
                                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                            </svg>
                                            <span>{onlineDetails?.favouriteCount !== undefined ? onlineDetails.favouriteCount.toLocaleString() : (isFavorite ? 1 : 0)}</span>
                                        </button>

                                        <div className={styles.metaChip} title="Length">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 16 14" />
                                            </svg>
                                            <span>{durationFormatted}</span>
                                        </div>

                                        <div className={styles.metaChip} title="Beats per minute">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                            </svg>
                                            <span>{bpm} BPM</span>
                                        </div>
                                    </div>

                                    <div className={styles.difficultyBannerRow}>
                                        <span
                                            className={styles.starPillBadge}
                                            style={{ backgroundColor: starColor }}
                                        >
                                            <span>★</span>
                                            <span>{starRating !== undefined ? starRating.toFixed(2) : "0.00"}</span>
                                        </span>
                                        <span className={styles.diffNameBig}>{selectedDifficulty.versionName}</span>
                                        <span className={styles.diffMapperSub}>
                                            mapped by <b>{selectedSet.creator}</b>
                                        </span>
                                    </div>

                                    <div className={styles.catchMetricsRow}>
                                        <div className={styles.metricCol}>
                                            <span className={styles.metricLabel}>Fruits</span>
                                            <span className={styles.metricValue}>{catchCounts.fruits}</span>
                                        </div>
                                        <div className={styles.metricCol}>
                                            <span className={styles.metricLabel}>Juice Streams</span>
                                            <span className={styles.metricValue}>{catchCounts.juiceStreams}</span>
                                        </div>
                                        <div className={styles.metricCol}>
                                            <span className={styles.metricLabel}>Banana Showers</span>
                                            <span className={styles.metricValue}>{catchCounts.bananaShowers}</span>
                                        </div>
                                        {diffParsed && (
                                            <>
                                                <div className={styles.metricCol}>
                                                    <span className={styles.metricLabel}>Circle Size</span>
                                                    <span className={styles.metricValue}>{diffParsed.difficulty.circleSize.toFixed(0)}</span>
                                                </div>
                                                <div className={styles.metricCol}>
                                                    <span className={styles.metricLabel}>Approach Rate</span>
                                                    <span className={styles.metricValue}>{diffParsed.difficulty.approachRate.toFixed(0)}</span>
                                                </div>
                                                <div className={styles.metricCol}>
                                                    <span className={styles.metricLabel}>HP Drain</span>
                                                    <span className={styles.metricValue}>{diffParsed.difficulty.drainRate.toFixed(0)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.leftPanelTabsBar}>
                                    <div className={styles.tabsLeft}>
                                        <button
                                            type="button"
                                            className={`${styles.tabBtn} ${activeTab === "details" ? styles.tabBtnActive : ""}`}
                                            onClick={() => setActiveTab("details")}
                                        >
                                            Details
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.tabBtn} ${activeTab === "ranking" ? styles.tabBtnActive : ""}`}
                                            onClick={() => setActiveTab("ranking")}
                                        >
                                            Ranking
                                        </button>
                                    </div>
                                </div>

                                {activeTab === "ranking" && (
                                    <div className={styles.leaderboardScrollArea}>
                                        {localScores.length > 0 ? (
                                            localScores.map((rec, idx) => (
                                                <div key={rec.id} className={styles.scoreRowCard}>
                                                    <div className={styles.scoreRowLeft}>
                                                        <span className={styles.scoreRankNum}>#{idx + 1}</span>
                                                        <div className={styles.scoreAvatar}>
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#8c8c9e">
                                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                            </svg>
                                                        </div>
                                                        <div className={styles.scorePlayerMeta}>
                                                            <div className={styles.scorePlayerTop}>
                                                                <span>{rec.countryFlag}</span>
                                                                <span className={styles.scorePlayerName}>{rec.playerName}</span>
                                                            </div>
                                                            <span className={styles.scoreTimeAgo}>{formatTimeAgo(rec.date)}</span>
                                                        </div>
                                                    </div>

                                                    <div className={styles.scoreRowStats}>
                                                        <div className={styles.scoreStatItem}>
                                                            <span className={styles.scoreStatLabel}>MAX COMBO</span>
                                                            <span className={styles.scoreStatVal}>{rec.maxCombo}x</span>
                                                        </div>
                                                        <div className={styles.scoreStatItem}>
                                                            <span className={styles.scoreStatLabel}>ACCURACY</span>
                                                            <span className={styles.scoreStatVal}>{rec.accuracy.toFixed(2)}%</span>
                                                        </div>
                                                        <div className={styles.scoreBigNum}>
                                                            {rec.score.toLocaleString()}
                                                        </div>
                                                        <div className={`${styles.gradeWedgeBadge} ${getGradeBadgeClass(rec.grade)}`}>
                                                            {rec.grade}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={styles.scoreDeleteBtn}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteScore(rec.id);
                                                            }}
                                                            title="Delete this score"
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                                <line x1="6" y1="6" x2="18" y2="18" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className={styles.emptyLeaderboard}>
                                                <div className={styles.emptyLeaderboardIcon}>
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="8" r="6" />
                                                        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                                                    </svg>
                                                </div>
                                                <div className={styles.emptyLeaderboardTitle}>No records set yet</div>
                                                <div className={styles.emptyLeaderboardSub}>
                                                    Play this beatmap to set your first local high score!
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === "details" && (
                                    <div className={styles.detailsTabContainer}>
                                        {isLoadingDetails ? (
                                            <div className={styles.detailsLoading}>
                                                <div className={styles.spinner} />
                                                <span>Fetching beatmap info...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={styles.detailsCard}>
                                                    <div className={styles.detailsGrid}>
                                                        <div className={styles.detailsCol}>
                                                            <div className={styles.detailsField}>
                                                                <span className={styles.detailsLabel}>Creator</span>
                                                                <span className={styles.detailsValueLink}>
                                                                    {onlineDetails?.creator || diffParsed?.metadata.creator || selectedSet.creator}
                                                                </span>
                                                            </div>
                                                            <div className={styles.detailsField}>
                                                                <span className={styles.detailsLabel}>Genre</span>
                                                                <span className={styles.detailsValueLink}>
                                                                    {onlineDetails?.genre || "Pop"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className={styles.detailsCol}>
                                                            <div className={styles.detailsField}>
                                                                <span className={styles.detailsLabel}>Source</span>
                                                                <span className={styles.detailsValueLink}>
                                                                    {onlineDetails?.source || diffParsed?.metadata.source || "—"}
                                                                </span>
                                                            </div>
                                                            <div className={styles.detailsField}>
                                                                <span className={styles.detailsLabel}>Language</span>
                                                                <span className={styles.detailsValueLink}>
                                                                    {onlineDetails?.language || "Japanese"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className={styles.detailsCol}>
                                                            <div className={styles.detailsField}>
                                                                <span className={styles.detailsLabel}>Submitted</span>
                                                                <span className={styles.detailsValue}>
                                                                    {onlineDetails?.submittedDate ? formatRelativeDate(onlineDetails.submittedDate) : "—"}
                                                                </span>
                                                            </div>
                                                            <div className={styles.detailsField}>
                                                                <span className={styles.detailsLabel}>Ranked</span>
                                                                <span className={styles.detailsValue}>
                                                                    {onlineDetails?.rankedDate ? formatRelativeDate(onlineDetails.rankedDate) : "—"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={styles.detailsTagsRow}>
                                                        <span className={styles.detailsLabel}>Mapper Tags</span>
                                                        <span className={styles.tagsText}>
                                                            {onlineDetails?.tags || (Array.isArray(diffParsed?.metadata.tags) ? diffParsed.metadata.tags.join(" ") : diffParsed?.metadata.tags) || "None"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className={styles.detailsCard}>
                                                    <div className={styles.statsCardGrid}>
                                                        <div className={styles.statBox}>
                                                            <span className={styles.statBoxTitle}>Success Rate</span>
                                                            <span className={styles.statBoxNumber}>
                                                                {onlineDetails ? `${onlineDetails.successRate}%` : "—"}
                                                            </span>
                                                            <div className={styles.progressBarBg}>
                                                                <div
                                                                    className={styles.progressBarFill}
                                                                    style={{ width: `${Math.min(100, Math.max(0, onlineDetails?.successRate ?? 0))}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className={styles.statBox}>
                                                            <span className={styles.statBoxTitle}>User Rating</span>
                                                            <div className={styles.userRatingRange}>
                                                                <span>1</span>
                                                                <span>{onlineDetails?.ratingCount || 10}</span>
                                                            </div>
                                                            <div className={styles.userRatingBar}>
                                                                <div className={styles.userRatingDot} />
                                                                <div
                                                                    className={styles.userRatingFill}
                                                                    style={{ width: `${Math.min(100, Math.max(0, ((onlineDetails?.userRating ?? 8) / 10) * 100))}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className={styles.statBox}>
                                                            <span className={styles.statBoxTitle}>Rating Spread</span>
                                                            <div className={styles.ratingSpreadBars}>
                                                                {(onlineDetails?.ratingSpread && onlineDetails.ratingSpread.length === 10
                                                                    ? onlineDetails.ratingSpread
                                                                    : [0, 0, 0, 0, 0, 0, 0, 1, 1, 10]
                                                                ).map((count, idx, arr) => {
                                                                    const max = Math.max(1, ...arr);
                                                                    const hPercent = Math.max(12, Math.round((count / max) * 100));
                                                                    return (
                                                                        <div
                                                                            key={idx}
                                                                            className={styles.spreadBar}
                                                                            style={{ height: `${hPercent}%` }}
                                                                            title={`${idx + 1}★: ${count} votes`}
                                                                        />
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={styles.detailsCard}>
                                                    <span className={styles.statBoxTitle}>Points of Failure</span>
                                                    <div className={styles.failureHistogram}>
                                                        {(onlineDetails?.pointsOfFailure && onlineDetails.pointsOfFailure.length === 100
                                                            ? onlineDetails.pointsOfFailure
                                                            : Array.from({ length: 100 }, () => 0)
                                                        ).map((failCount, idx, arr) => {
                                                            const maxFails = Math.max(1, ...arr);
                                                            const heightPx = failCount > 0
                                                                ? Math.max(6, Math.min(54, Math.round((failCount / maxFails) * 54)))
                                                                : 3;
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className={`${styles.failBar} ${failCount > 0 ? styles.failBarActive : ""}`}
                                                                    style={{ height: `${heightPx}px` }}
                                                                    title={`Timestamp ~${idx}%: ${failCount} fails`}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyTitle}>No beatmaps selected</div>
                                <p style={{ fontSize: "13px", margin: "4px 0 16px" }}>Import a song or load the built-in sample.</p>
                                <button
                                    type="button"
                                    className={styles.sampleLoadBtn}
                                    onClick={() => void handleLoadSampleBeatmap()}
                                    disabled={isBeatmapBusy}
                                >
                                    Load Sample Beatmap
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={styles.carouselRightPanel}>
                        <div className={styles.carouselHeaderArea}>
                            <div className={styles.searchBarWrapper}>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className={styles.searchBarInput}
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <span className={styles.searchMatchesCount}>
                                    {filteredSets.length} matches
                                </span>
                                <div className={styles.searchIconBtn}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </div>
                            </div>

                            <div className={styles.filterRowPills}>
                                <div
                                    className={styles.filterChip}
                                    onClick={() => setSortMode((prev) => {
                                        if (prev === "lastPlayed") return "title";
                                        if (prev === "title") return "artist";
                                        if (prev === "artist") return "stars";
                                        return "lastPlayed";
                                    })}
                                    title="Click to cycle sort"
                                >
                                    <span>Sort:</span>
                                    <span className={styles.filterChipVal}>
                                        {sortMode === "lastPlayed" && "Last Played ▾"}
                                        {sortMode === "title" && "Title ▾"}
                                        {sortMode === "artist" && "Artist ▾"}
                                        {sortMode === "stars" && "Difficulty ▾"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.carouselCardsArea}>
                            {filteredSets.length > 0 ? (
                                filteredSets.map((s) => {
                                    const isSetSelected = selectedSet?.id === s.id;
                                    const thumbUrl = bgThumbnails.get(s.id);

                                    return (
                                        <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                            {isSetSelected ? (
                                                <>
                                                    <div className={styles.lazerSetHeaderActive}>
                                                        <div className={styles.selectedSetIndicator} />
                                                        <div className={styles.lazerCardContent}>
                                                            <div className={styles.lazerCardTitle} title={s.title}>
                                                                {s.title}
                                                            </div>
                                                            <div className={styles.lazerCardArtist} title={s.artist}>
                                                                {s.artist}
                                                            </div>
                                                        </div>
                                                        <div style={{ color: "#ffffff", fontWeight: "900", fontSize: "16px" }}>
                                                            ›
                                                        </div>
                                                    </div>

                                                    {s.difficulties.map((diff: BeatmapDifficulty) => {
                                                        const isDiffActive = selectedDifficulty?.id === diff.id;
                                                        const stars = diff.starRating;
                                                        const badgeColor = getStarRatingColor(stars);
                                                        const bestScore = getBestScore(s.id, diff.id);

                                                        return (
                                                            <div
                                                                key={diff.id}
                                                                className={`${styles.lazerDiffCard} ${isDiffActive ? styles.lazerDiffCardActive : ""}`}
                                                                onClick={() => {
                                                                    selectSet(s);
                                                                    selectDifficulty(diff.id);
                                                                }}
                                                                role="button"
                                                                tabIndex={0}
                                                            >
                                                                <div className={styles.diffCardLeft}>
                                                                    {bestScore ? (
                                                                        <div className={`${styles.diffIconPill} ${getGradeBadgeClass(bestScore.grade)}`}>
                                                                            {bestScore.grade}
                                                                        </div>
                                                                    ) : (
                                                                        <div className={styles.diffDot} style={{ backgroundColor: badgeColor }} />
                                                                    )}
                                                                    <span className={styles.diffNameText}>{diff.versionName}</span>
                                                                </div>

                                                                <div className={styles.diffCardRight}>
                                                                    {stars !== undefined && (
                                                                        <span
                                                                            className={styles.starRatingBadge}
                                                                            style={{ backgroundColor: badgeColor }}
                                                                        >
                                                                            <span>★</span>
                                                                            <span>{stars.toFixed(2)}</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </>
                                            ) : (
                                                <div
                                                    className={styles.lazerSetCard}
                                                    onClick={() => {
                                                        selectSet(s);
                                                        if (s.difficulties.length > 0) {
                                                            selectDifficulty(s.difficulties[0].id);
                                                        }
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                >
                                                    {thumbUrl && (
                                                        <div
                                                            className={styles.lazerCardBg}
                                                            style={{ backgroundImage: `url(${thumbUrl})` }}
                                                        />
                                                    )}
                                                    <div className={styles.lazerCardContent}>
                                                        <div className={styles.lazerCardTitle} title={s.title}>
                                                            {s.title}
                                                        </div>
                                                        <div className={styles.lazerCardArtist} title={s.artist}>
                                                            {s.artist}
                                                        </div>
                                                    </div>

                                                    <div className={styles.lazerCardRight}>
                                                        <div className={styles.diffDotsRow}>
                                                            {s.difficulties.slice(0, 6).map((d) => (
                                                                <div
                                                                    key={d.id}
                                                                    className={styles.diffDot}
                                                                    style={{ backgroundColor: getStarRatingColor(d.starRating) }}
                                                                    title={`${d.versionName} (${d.starRating?.toFixed(2) ?? "?"}★)`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyTitle}>
                                        {searchQuery ? "No matches found" : "No beatmaps available"}
                                    </div>
                                    <p style={{ fontSize: "12px", margin: "4px 0" }}>
                                        {searchQuery ? "Try a different search term" : "Drag and drop .osz file here to import"}
                                    </p>
                                    {!searchQuery && (
                                        <button
                                            type="button"
                                            className={styles.sampleLoadBtn}
                                            onClick={() => void handleLoadSampleBeatmap()}
                                            disabled={isBeatmapBusy}
                                            style={{ marginTop: "8px" }}
                                        >
                                            Load Sample Song
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {view === "songSelect" && (
                <footer className={styles.lazerBottomBar}>
                    <div className={styles.bottomBarLeft}>
                        <button
                            type="button"
                            className={styles.lazerBackBtn}
                            onClick={() => setView("home")}
                            title="Back (Esc)"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            <span>Back</span>
                        </button>
                    </div>

                    <div className={styles.bottomBarCenter}>
                        <button
                            type="button"
                            className={styles.bottomActionBtn}
                            onClick={handleRandomSelect}
                            title="Random Beatmap (F2)"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="16 3 21 3 21 8" />
                                <line x1="4" y1="20" x2="21" y2="3" />
                                <polyline points="21 16 21 21 16 21" />
                                <line x1="15" y1="15" x2="21" y2="21" />
                                <line x1="4" y1="4" x2="9" y2="9" />
                            </svg>
                            <span>Random</span>
                        </button>
                    </div>

                    <div className={styles.bottomBarRight}>
                        <div
                            className={styles.squarePlayBtn}
                            onClick={() => {
                                if (canPlay) onPlay();
                            }}
                            title={canPlay ? "Click to Play (Enter)" : "Select a map to play"}
                            role="button"
                            tabIndex={0}
                            style={{ opacity: canPlay ? 1 : 0.6, cursor: canPlay ? "pointer" : "not-allowed" }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="6 3 20 12 6 21 6 3" />
                            </svg>
                        </div>
                    </div>
                </footer>
            )}

            {isDraggingOver && (
                <div className={styles.dropOverlay}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff66aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <div className={styles.dropTitle}>DROP ARCHIVE TO IMPORT</div>
                    <div className={styles.dropSub}>Supported formats: .osz (Beatmap) and .osk (Skin)</div>
                </div>
            )}

            {toasts.length > 0 && (
                <div className={styles.toastContainer}>
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}
                        >
                            <span>{toast.message}</span>
                            <button
                                type="button"
                                className={styles.toastClose}
                                onClick={() => removeToast(toast.id)}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showSettings && (
                <MainMenuSettings
                    settings={settings}
                    onChange={handleSettingChange}
                    onReset={handleSettingReset}
                    onResetAll={handleResetAll}
                    onClose={() => setShowSettings(false)}
                    skinList={skinList}
                    activeSkinName={activeSkin?.name ?? ""}
                    onSelectSkin={(name) => void handleSkinSelection(name)}
                    onImportSkin={() => void handleSkinImport()}
                    isImportingSkin={isImportingSkin}
                />
            )}
        </div>
    );
}
