

interface TitleCacheEntry {
    title: string;
    year?: number;
    timestamp: number;
}

class ContentTitleCache {
    private cache: Map<string, TitleCacheEntry> = new Map();
    private readonly TTL = 1000 * 60 * 60; // 1 hour cache

    /**
     * Get content title from cache or fetch from TMDB
     */
    async getTitle(contentId: string, contentType: 'movie' | 'tv'): Promise<string> {
        // Check cache first
        const cached = this.cache.get(`${contentType}-${contentId}`);
        if (cached && Date.now() - cached.timestamp < this.TTL) {
            return this.formatTitle(cached.title, cached.year);
        }

        // Fetch from TMDB
        try {
            const details = await this.fetchFromTMDB(contentId, contentType);
            if (details) {
                this.cache.set(`${contentType}-${contentId}`, {
                    title: details.title,
                    year: details.year,
                    timestamp: Date.now()
                });
                return this.formatTitle(details.title, details.year);
            }
        } catch (error) {
            console.error(`Failed to fetch title for ${contentType} ${contentId}:`, error);
        }

        // Fallback to ID
        return `${contentType === 'movie' ? 'Movie' : 'Show'} #${contentId}`;
    }

    /**
     * Batch fetch multiple titles
     */
    async getTitles(items: Array<{ contentId: string; contentType: 'movie' | 'tv' }>): Promise<Map<string, string>> {
        const results = new Map<string, string>();

        // Process in parallel
        await Promise.all(
            items.map(async (item) => {
                const title = await this.getTitle(item.contentId, item.contentType);
                results.set(`${item.contentType}-${item.contentId}`, title);
            })
        );

        return results;
    }

    private async fetchFromTMDB(contentId: string, contentType: 'movie' | 'tv'): Promise<{ title: string; year?: number } | null> {
        try {
            const url = `https://api.themoviedb.org/3/${contentType}/${contentId}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`;
            const response = await fetch(url);

            if (!response.ok) return null;

            const data = await response.json();

            if (contentType === 'movie') {
                return {
                    title: data.title || data.original_title,
                    year: data.release_date ? new Date(data.release_date).getFullYear() : undefined
                };
            } else {
                return {
                    title: data.name || data.original_name,
                    year: data.first_air_date ? new Date(data.first_air_date).getFullYear() : undefined
                };
            }
        } catch (error) {
            console.error('TMDB fetch error:', error);
            return null;
        }
    }

    private formatTitle(title: string, year?: number): string {
        if (year) {
            return `${title} (${year})`;
        }
        return title;
    }

    /**
     * Clear expired cache entries
     */
    clearExpired(): void {
        const now = Date.now();
        this.cache.forEach((entry, key) => {
            if (now - entry.timestamp >= this.TTL) {
                this.cache.delete(key);
            }
        });
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
    }
}

// Singleton instance
export const contentTitleCache = new ContentTitleCache();

// Clear expired entries every 10 minutes
if (typeof window !== 'undefined') {
    setInterval(() => {
        contentTitleCache.clearExpired();
    }, 1000 * 60 * 10);
}
