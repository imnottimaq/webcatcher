export interface LocalScoreRecord {
    id: string;
    mapId: string;
    diffId: string;
    playerName: string;
    avatarUrl?: string;
    countryFlag: string;
    score: number;
    maxCombo: number;
    accuracy: number;
    grade: "SS" | "S" | "A" | "B" | "C" | "D";
    date: number;
    fruitsHit?: number;
    dropletsHit?: number;
    tinyHit?: number;
    misses?: number;
}

export interface SaveScoreResult {
    record: LocalScoreRecord;
    isPersonalBest: boolean;
    rank: number;
}

export function formatTimeAgo(timestamp: number): string {
    const diff = Math.max(0, Date.now() - timestamp);
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
}

function getStorageKey(mapId: string, diffId: string): string {
    return `webcatcher_scores_${mapId}_${diffId}`;
}

function getPlaysStorageKey(mapId: string, diffId?: string): string {
    return diffId ? `webcatcher_plays_${mapId}_${diffId}` : `webcatcher_plays_${mapId}`;
}

const FAVORITES_STORAGE_KEY = "webcatcher_favorites";

export function getLocalScores(mapId: string, diffId: string): LocalScoreRecord[] {
    if (!mapId || !diffId) return [];
    try {
        const raw = localStorage.getItem(getStorageKey(mapId, diffId));
        if (raw) {
            const parsed = JSON.parse(raw) as LocalScoreRecord[];
            if (Array.isArray(parsed)) {
                return parsed.sort((a, b) => b.score - a.score);
            }
        }
    } catch (e) {
        console.warn("Failed to read local scores", e);
    }
    return [];
}

export function getBestScore(mapId: string, diffId: string): LocalScoreRecord | undefined {
    const scores = getLocalScores(mapId, diffId);
    return scores[0];
}

export function saveLocalScore(
    mapId: string,
    diffId: string,
    score: {
        playerName?: string;
        score: number;
        maxCombo: number;
        accuracy: number;
        grade: "SS" | "S" | "A" | "B" | "C" | "D";
        fruitsHit?: number;
        dropletsHit?: number;
        tinyHit?: number;
        misses?: number;
    },
): SaveScoreResult {
    const existing = getLocalScores(mapId, diffId);
    const prevBestScore = existing.length > 0 ? existing[0].score : -1;

    const newRecord: LocalScoreRecord = {
        id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        mapId,
        diffId,
        playerName: (score.playerName && score.playerName.trim()) ? score.playerName.trim() : "Player",
        countryFlag: "🇺🇦",
        score: Math.max(0, Math.floor(score.score)),
        maxCombo: Math.max(0, score.maxCombo),
        accuracy: Math.max(0, Math.min(100, Number(score.accuracy.toFixed(2)))),
        grade: score.grade,
        date: Date.now(),
        fruitsHit: score.fruitsHit,
        dropletsHit: score.dropletsHit,
        tinyHit: score.tinyHit,
        misses: score.misses,
    };

    const updated = [newRecord, ...existing]
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

    try {
        localStorage.setItem(getStorageKey(mapId, diffId), JSON.stringify(updated));
    } catch (e) {
        console.warn("Failed to save local score", e);
    }

    const rank = updated.findIndex((r) => r.id === newRecord.id) + 1;
    const isPersonalBest = score.score > prevBestScore;

    return {
        record: newRecord,
        isPersonalBest,
        rank,
    };
}

export function deleteLocalScore(mapId: string, diffId: string, scoreId: string): LocalScoreRecord[] {
    const existing = getLocalScores(mapId, diffId);
    const filtered = existing.filter((s) => s.id !== scoreId);
    try {
        localStorage.setItem(getStorageKey(mapId, diffId), JSON.stringify(filtered));
    } catch (e) {
        console.warn("Failed to delete local score", e);
    }
    return filtered;
}

export function clearLocalScores(mapId: string, diffId: string): void {
    try {
        localStorage.removeItem(getStorageKey(mapId, diffId));
    } catch (e) {
        console.warn("Failed to clear local scores", e);
    }
}

export function getBeatmapPlayCount(mapId: string, diffId?: string): number {
    try {
        const val = localStorage.getItem(getPlaysStorageKey(mapId, diffId));
        return val ? parseInt(val, 10) || 0 : 0;
    } catch {
        return 0;
    }
}

export function incrementPlayCount(mapId: string, diffId?: string): number {
    try {
        const count = getBeatmapPlayCount(mapId, diffId) + 1;
        localStorage.setItem(getPlaysStorageKey(mapId, diffId), count.toString());
        if (diffId) {
            const setCount = getBeatmapPlayCount(mapId) + 1;
            localStorage.setItem(getPlaysStorageKey(mapId), setCount.toString());
        }
        return count;
    } catch {
        return 1;
    }
}

export function isBeatmapFavorite(mapId: string): boolean {
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return false;
        const favs = JSON.parse(raw) as string[];
        return Array.isArray(favs) && favs.includes(mapId);
    } catch {
        return false;
    }
}

export function toggleBeatmapFavorite(mapId: string): boolean {
    try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        let favs: string[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(favs)) favs = [];

        const exists = favs.includes(mapId);
        if (exists) {
            favs = favs.filter((id) => id !== mapId);
        } else {
            favs.push(mapId);
        }

        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
        return !exists;
    } catch {
        return false;
    }
}
