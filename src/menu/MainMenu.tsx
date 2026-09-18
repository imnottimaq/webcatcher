import { useEffect, useState } from "react";
import { getImportedSkin, importSkinArchive } from "../files/skin/skinImporter";
import { getImportedBeatmapSet, importBeatmapArchive } from "../files/beatmap/beatmapImporter";
import { useSkin } from "../contexts/skinContextValue";
import { useBeatmap } from "../contexts/beatmapContextValue";
import { EnumDir } from "../files/shared";

interface MainMenuProps {
    onPlay(): void;
}

function sortNames(names: string[]): string[] {
    return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

export default function MainMenu({ onPlay }: MainMenuProps) {
    const [isImporting, setIsImporting] = useState(false);
    const [isSelecting, setIsSelecting] = useState(false);
    const [importMessage, setImportMessage] = useState<string>();
    const [skinList, setSkinList] = useState<string[]>([]);
    const [beatmapList, setBeatmapList] = useState<string[]>([]);
    const [isBeatmapBusy, setIsBeatmapBusy] = useState(false);
    const [beatmapMessage, setBeatmapMessage] = useState<string>();
    const { activeSkin, isReady, setActiveSkin } = useSkin();
    const {
        selectedSet,
        selectedDifficulty,
        selectSet,
        selectDifficulty,
    } = useBeatmap();

    useEffect(() => {
        let cancelled = false;

        void EnumDir("skins").then((names) => {
            if (!cancelled) setSkinList(sortNames(names));
        }).catch((error) => {
            if (!cancelled) {
                console.error("Failed to load imported skins", error);
                setImportMessage("Failed to load imported skins");
            }
        });

        void EnumDir("beatmaps").then((names) => {
            if (!cancelled) setBeatmapList(sortNames(names));
        }).catch((error) => {
            if (!cancelled) {
                console.error("Failed to load imported beatmaps", error);
                setBeatmapMessage("Failed to load imported beatmaps");
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    async function handleSkinImport(): Promise<void> {
        setIsImporting(true);
        setImportMessage(undefined);

        try {
            const skin = await importSkinArchive();
            setActiveSkin(skin);
            setSkinList((current) => sortNames([...current, skin.name]));
            setImportMessage(`Imported skin: ${skin.name}`);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            console.error("Failed to import skin", error);
            setImportMessage("Failed to import skin");
        } finally {
            setIsImporting(false);
        }
    }

    async function handleSkinSelection(name: string): Promise<void> {
        setImportMessage(undefined);

        if (!name) {
            setActiveSkin(undefined);
            return;
        }

        setIsSelecting(true);

        try {
            const skin = await getImportedSkin(name);

            if (!skin) {
                setActiveSkin(undefined);
                setSkinList((current) => current.filter((item) => item !== name));
                setImportMessage(`Skin not found: ${name}`);
                return;
            }

            setActiveSkin(skin);
        } catch (error) {
            console.error("Failed to select skin", error);
            setImportMessage("Failed to select skin");
        } finally {
            setIsSelecting(false);
        }
    }

    async function handleBeatmapImport(): Promise<void> {
        setIsBeatmapBusy(true);
        setBeatmapMessage(undefined);

        try {
            const beatmapSet = await importBeatmapArchive();
            selectSet(beatmapSet);
            setBeatmapList((current) => sortNames([...current, beatmapSet.id]));
            setBeatmapMessage(`Imported beatmap: ${beatmapSet.artist} – ${beatmapSet.title}`);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            console.error("Failed to import beatmap", error);
            setBeatmapMessage("Failed to import beatmap");
        } finally {
            setIsBeatmapBusy(false);
        }
    }

    async function handleBeatmapSelection(name: string): Promise<void> {
        setBeatmapMessage(undefined);

        if (!name) {
            selectSet(undefined);
            return;
        }

        setIsBeatmapBusy(true);

        try {
            const beatmapSet = await getImportedBeatmapSet(name);

            if (!beatmapSet) {
                selectSet(undefined);
                setBeatmapList((current) => current.filter((item) => item !== name));
                setBeatmapMessage(`Beatmap not found: ${name}`);
                return;
            }

            selectSet(beatmapSet);
        } catch (error) {
            console.error("Failed to select beatmap", error);
            setBeatmapMessage("Failed to select beatmap");
        } finally {
            setIsBeatmapBusy(false);
        }
    }

    const skinControlsDisabled = !isReady || isImporting || isSelecting;

    return (
        <div>
            <button
                disabled={skinControlsDisabled || isBeatmapBusy || !selectedDifficulty}
                onClick={onPlay}
            >
                Play
            </button>

            <section>
                <button
                    disabled={skinControlsDisabled}
                    onClick={() => void handleSkinImport()}
                >
                    {isImporting ? "Importing..." : "Import skin"}
                </button>
                <select
                    aria-label="Skin select"
                    disabled={skinControlsDisabled}
                    value={activeSkin?.name ?? ""}
                    onChange={(event) => void handleSkinSelection(event.currentTarget.value)}
                >
                    <option value="">Default</option>
                    {skinList.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                {importMessage && <p>{importMessage}</p>}
            </section>

            <section>
                <button
                    disabled={isBeatmapBusy}
                    onClick={() => void handleBeatmapImport()}
                >
                    {isBeatmapBusy ? "Loading..." : "Import beatmap"}
                </button>
                <select
                    aria-label="Beatmap select"
                    disabled={isBeatmapBusy}
                    value={selectedSet?.id ?? ""}
                    onChange={(event) => void handleBeatmapSelection(event.currentTarget.value)}
                >
                    <option value="">Select beatmap</option>
                    {beatmapList.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                <select
                    aria-label="Difficulty select"
                    disabled={isBeatmapBusy || !selectedSet}
                    value={selectedDifficulty?.id ?? ""}
                    onChange={(event) => selectDifficulty(event.currentTarget.value)}
                >
                    <option value="">Select difficulty</option>
                    {selectedSet?.difficulties.map((difficulty) => (
                        <option key={difficulty.id} value={difficulty.id}>
                            {difficulty.versionName}
                            {difficulty.starRating !== undefined
                                ? ` (${difficulty.starRating.toFixed(2)}★)`
                                : ""}
                        </option>
                    ))}
                </select>
                {selectedSet && (
                    <p>
                        {selectedSet.artist} – {selectedSet.title} mapped by {selectedSet.creator}
                    </p>
                )}
                {beatmapMessage && <p>{beatmapMessage}</p>}
            </section>
        </div>
    );
}

