/**
 * Language detection and filtering for stream sources
 */

interface SourceWithLanguage {
    language?: string;
    title: string;
    url: string;
    [key: string]: any;
}

/**
 * Detect and prioritize English sources
 * Filters out sources with foreign language indicators and prioritizes clean English releases
 */
export function detectAndSortByLanguage<T extends SourceWithLanguage>(sources: T[]): T[] {
    // Detect language for each source
    sources.forEach(stream => {
        const urlLower = stream.url.toLowerCase();
        const titleLower = stream.title.toLowerCase();

        // Foreign language indicators (country codes, subtitle markers, dubbed markers)
        const foreignLanguagePatterns = [
            // Language names
            /\b(spanish|french|german|italian|portuguese|russian|japanese|korean|chinese|hindi|arabic|turkish|polish|dutch|swedish|norwegian|danish|finnish)\b/,
            // Country/language codes
            /\b(ar|indo|lat|latino|spa|fra|deu|ita|por|rus|jpn|kor|chi|hin|ara|tur|pol|nld|swe|nor|dan|fin)\b/,
            // Subtitle/dub markers
            /\b(sub|subs|subtitle|subtitles|dubbed|dub|cc)\b/,
            // Common foreign indicators  
            /\b(multi|dual)\b/
        ];

        const hasForeignIndicators = foreignLanguagePatterns.some(pattern =>
            pattern.test(titleLower) || pattern.test(urlLower)
        );

        // Positive English indicators (quality markers that suggest proper English release)
        const englishQualityMarkers = /\b(web-dl|webrip|bluray|brrip|hdrip|hdtv|proper|repack)\b/;
        const hasEnglishQualityMarkers = englishQualityMarkers.test(titleLower);

        // Determine language
        if (hasForeignIndicators) {
            stream.language = 'foreign';
        } else if (hasEnglishQualityMarkers) {
            stream.language = 'english-quality'; // Preferred English with quality markers
        } else {
            stream.language = 'english'; // Standard English
        }
    });

    // Sort: English with quality markers first, then standard English, then foreign
    sources.sort((a, b) => {
        const priority: Record<string, number> = { 'english-quality': 0, 'english': 1, 'foreign': 2, 'unknown': 3 };
        const aPriority = priority[a.language || 'unknown'] ?? 3;
        const bPriority = priority[b.language || 'unknown'] ?? 3;
        return aPriority - bPriority;
    });

    console.log('[LanguageFilter] Sorted sources by language priority:', sources.map(s => ({
        title: s.title,
        language: s.language
    })));

    return sources;
}
