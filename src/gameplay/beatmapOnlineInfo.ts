export interface BeatmapOnlineDetails {
    status: string;
    playcount: number;
    passcount: number;
    favouriteCount: number;
    creator: string;
    source: string;
    genre: string;
    language: string;
    submittedDate: string;
    rankedDate: string;
    tags: string;
    successRate: number;
    userRating: number;
    ratingCount: number;
    ratingSpread: number[];
    pointsOfFailure: number[];
}

const cache = new Map<number, BeatmapOnlineDetails>();

export function formatTimeAgo(dateStr?: string): string {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    const time = date.getTime();
    if (Number.isNaN(time)) return "Unknown";

    const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
    const diffDays = Math.floor(diffSec / 86400);

    if (diffDays < 1) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 30) return `${diffDays} days ago`;

    const diffMonths = Math.floor(diffDays / 30.4375);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

export async function fetchBeatmapOnlineDetails(beatmapId?: number): Promise<BeatmapOnlineDetails | null> {
    if (!beatmapId || beatmapId <= 0) return null;
    if (cache.has(beatmapId)) return cache.get(beatmapId) || null;

    try {
        const res = await fetch(`https://catboy.best/api/v2/b/${beatmapId}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
        });

        if (!res.ok) {
            cache.set(beatmapId, null as unknown as BeatmapOnlineDetails);
            return null;
        }

        const data = await res.json();
        const set = data.set || {};
        const playcount = Number(data.playcount) || 1;
        const passcount = Number(data.passcount) || 0;
        const successRate = Number(((passcount / playcount) * 100).toFixed(2));

        const rawRatings = Array.isArray(set.ratings) ? set.ratings : [];
        const ratingSpread = rawRatings.length >= 11
            ? rawRatings.slice(1, 11)
            : rawRatings.slice(0, 10);
        const ratingCount = ratingSpread.reduce((sum: number, count: number) => sum + (Number(count) || 0), 0);

        const failArr = Array.isArray(data.failtimes?.fail) ? data.failtimes.fail : [];
        const pointsOfFailure = failArr.length === 100
            ? failArr
            : Array.from({ length: 100 }, (_, i) => failArr[i] ?? 0);

        const details: BeatmapOnlineDetails = {
            status: data.status || set.status || "ranked",
            playcount,
            passcount,
            favouriteCount: Number(set.favourite_count) || 0,
            creator: set.creator || "",
            source: set.source || "",
            genre: set.genre?.name || "Unspecified",
            language: set.language?.name || "Unspecified",
            submittedDate: set.submitted_date || "",
            rankedDate: set.ranked_date || "",
            tags: set.tags || "",
            successRate,
            userRating: Number(set.rating) || 0,
            ratingCount,
            ratingSpread,
            pointsOfFailure,
        };

        cache.set(beatmapId, details);
        return details;
    } catch {
        return null;
    }
}
