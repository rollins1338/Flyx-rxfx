'use client';

import React from 'react';

import { Slider } from '@/components/ui/Slider';
import { GENRES } from '@/lib/constants/genres';

interface SearchFilters {
    contentType: 'all' | 'movie' | 'tv' | 'person';
    genres: string[];
    yearRange: [number, number];
    minRating: number;
    sortBy: 'relevance' | 'rating' | 'release_date' | 'popularity';
}

interface SearchSidebarProps {
    filters: SearchFilters;
    onFilterChange: (newFilters: Partial<SearchFilters>) => void;
    className?: string;
}

export function SearchSidebar({ filters, onFilterChange, className = '' }: SearchSidebarProps) {
    // Get available genres based on content type
    const availableGenres = React.useMemo(() => {
        if (filters.contentType === 'person') return [];

        let genres = GENRES;
        if (filters.contentType === 'movie') {
            genres = GENRES.filter(g => g.type === 'movie');
        } else if (filters.contentType === 'tv') {
            genres = GENRES.filter(g => g.type === 'tv');
        }

        // Deduplicate by name for 'all' view
        const uniqueGenres = new Map();
        genres.forEach(g => {
            if (!uniqueGenres.has(g.name)) {
                uniqueGenres.set(g.name, g);
            }
        });

        return Array.from(uniqueGenres.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [filters.contentType]);

    const handleGenreToggle = (slug: string) => {
        const currentGenres = filters.genres;
        const newGenres = currentGenres.includes(slug)
            ? currentGenres.filter(g => g !== slug)
            : [...currentGenres, slug];
        onFilterChange({ genres: newGenres });
    };

    return (
        <aside className={`w-full lg:w-80 flex-shrink-0 ${className}`}>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sticky top-24 overflow-y-auto max-h-[calc(100vh-8rem)] custom-scrollbar">
                <div className="space-y-8">
                    {/* Content Type Tabs */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Content Type</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'movie', label: 'Movies' },
                                { id: 'tv', label: 'TV Shows' },
                                { id: 'person', label: 'People' },
                            ].map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => onFilterChange({ contentType: type.id as any })}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${filters.contentType === type.id
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sort By */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Sort By</h3>
                        <select
                            value={filters.sortBy}
                            onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
                            className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                        >
                            <option value="relevance">Relevance</option>
                            <option value="popularity">Popularity</option>
                            <option value="rating">Rating</option>
                            <option value="release_date">Release Date</option>
                        </select>
                    </div>

                    {/* Genres (Multi-select) */}
                    {filters.contentType !== 'person' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Genres</h3>
                                {filters.genres.length > 0 && (
                                    <button
                                        onClick={() => onFilterChange({ genres: [] })}
                                        className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {availableGenres.map((genre) => (
                                    <button
                                        key={genre.id}
                                        onClick={() => handleGenreToggle(genre.slug)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border ${filters.genres.includes(genre.slug)
                                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                                            }`}
                                    >
                                        {genre.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Year Range */}
                    {filters.contentType !== 'person' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Year Range</h3>
                                <span className="text-xs text-gray-400">
                                    {filters.yearRange[0]} - {filters.yearRange[1]}
                                </span>
                            </div>
                            <Slider
                                min={1900}
                                max={new Date().getFullYear()}
                                value={filters.yearRange}
                                onChange={(val) => onFilterChange({ yearRange: val })}
                            />
                        </div>
                    )}

                    {/* Rating */}
                    {filters.contentType !== 'person' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Min Rating</h3>
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                    {filters.minRating}+
                                </span>
                            </div>
                            <Slider
                                min={0}
                                max={10}
                                step={0.5}
                                value={[filters.minRating, 10]}
                                onChange={(val) => onFilterChange({ minRating: val[0] })}
                            />
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
