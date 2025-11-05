'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { MediaItem } from '@/types/media';
import { HeroSection } from '@/components/content/HeroSection';
import { CategoryRow } from '@/components/content/CategoryRow';
import { ContentGrid } from '@/components/content/ContentGrid';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { FluidButton } from '@/components/ui/FluidButton';
import { Card3D } from '@/components/ui/Card3D';
import { ParallaxContainer } from '@/components/ui/ParallaxContainer';
import styles from './HomePage.module.css';

interface HomePageClientProps {
  trendingToday: MediaItem[];
  trendingWeek: MediaItem[];
  popularMovies: MediaItem[];
  popularTV: MediaItem[];
  error: string | null;
}

/**
 * Home Page Client Component
 * Handles client-side interactions, infinite scroll, and animations
 */
export default function HomePageClient({
  trendingToday,
  trendingWeek,
  popularMovies,
  popularTV,
  error,
}: HomePageClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [additionalContent, setAdditionalContent] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Handle content card click
  const handleContentClick = useCallback((item: MediaItem) => {
    router.push(`/details/${item.id}?type=${item.mediaType}`);
  }, [router]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  }, [router]);

  // Load more content for infinite scroll
  const loadMoreContent = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      // Fetch next page of trending content
      const { tmdbService } = await import('@/lib/services/tmdb');
      const nextPage = page + 1;
      const moreContent = await tmdbService.getTrending('all', 'week');

      if (moreContent.length === 0) {
        setHasMore(false);
      } else {
        setAdditionalContent(prev => [...prev, ...moreContent]);
        setPage(nextPage);
      }
    } catch (err) {
      console.error('Error loading more content:', err);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, page]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMoreContent();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMoreContent, hasMore, isLoading]);

  // Get hero content (first trending item)
  const heroContent = trendingToday[0] || trendingWeek[0];

  return (
    <PageTransition>
      <div className={styles.homePage}>
        <Navigation onSearch={handleSearch} />

        {error ? (
          <div className={styles.errorContainer}>
            <GlassPanel className={styles.errorPanel}>
              <h2>Oops! Something went wrong</h2>
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className={styles.retryButton}
              >
                Retry
              </button>
            </GlassPanel>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            {heroContent && (
              <HeroSection
                item={heroContent}
                onPlay={() => handleContentClick(heroContent)}
                onMoreInfo={() => handleContentClick(heroContent)}
              />
            )}

            {/* Welcome Banner */}
            <section className={styles.welcomeBanner}>
              <ParallaxContainer height="h-auto" className="py-16">
                <div className="container mx-auto px-4 text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                  >
                    <h2 className={styles.welcomeTitle}>
                      Welcome to the Future of Entertainment
                    </h2>
                    <p className={styles.welcomeSubtitle}>
                      Discover unlimited movies and TV shows with crystal-clear streaming, 
                      personalized recommendations, and zero interruptions.
                    </p>
                    <div className={styles.welcomeFeatures}>
                      <div className={styles.featureItem}>
                        <div className={styles.featureIcon}>🎬</div>
                        <span>Unlimited Content</span>
                      </div>
                      <div className={styles.featureItem}>
                        <div className={styles.featureIcon}>⚡</div>
                        <span>Lightning Fast</span>
                      </div>
                      <div className={styles.featureItem}>
                        <div className={styles.featureIcon}>🎯</div>
                        <span>Smart Recommendations</span>
                      </div>
                      <div className={styles.featureItem}>
                        <div className={styles.featureIcon}>📱</div>
                        <span>All Devices</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </ParallaxContainer>
            </section>

            {/* Content Sections */}
            <main id="main-content" className={styles.contentSections}>
              {/* Trending Today */}
              {trendingToday.length > 0 && (
                <section className={styles.section}>
                  <CategoryRow
                    title="🔥 Trending Today"
                    items={trendingToday}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* Quick Stats Section */}
              <section className={styles.statsSection}>
                <div className="container mx-auto px-4">
                  <div className={styles.statsGrid}>
                    <Card3D className={styles.statCard}>
                      <div className={styles.statNumber}>50K+</div>
                      <div className={styles.statLabel}>Movies & Shows</div>
                    </Card3D>
                    <Card3D className={styles.statCard}>
                      <div className={styles.statNumber}>4K</div>
                      <div className={styles.statLabel}>Ultra HD Quality</div>
                    </Card3D>
                    <Card3D className={styles.statCard}>
                      <div className={styles.statNumber}>24/7</div>
                      <div className={styles.statLabel}>Always Available</div>
                    </Card3D>
                    <Card3D className={styles.statCard}>
                      <div className={styles.statNumber}>0</div>
                      <div className={styles.statLabel}>Ads or Interruptions</div>
                    </Card3D>
                  </div>
                </div>
              </section>

              {/* Popular Movies */}
              {popularMovies.length > 0 && (
                <section className={styles.section}>
                  <CategoryRow
                    title="🎭 Popular Movies"
                    items={popularMovies}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* Genre Spotlight */}
              <section className={styles.genreSpotlight}>
                <div className="container mx-auto px-4">
                  <h2 className={styles.sectionTitle}>🎨 Explore by Genre</h2>
                  <div className={styles.genreGrid}>
                    {[
                      { name: 'Action', emoji: '💥', color: 'from-red-500 to-orange-500' },
                      { name: 'Comedy', emoji: '😂', color: 'from-yellow-500 to-pink-500' },
                      { name: 'Drama', emoji: '🎭', color: 'from-purple-500 to-blue-500' },
                      { name: 'Horror', emoji: '👻', color: 'from-gray-800 to-red-900' },
                      { name: 'Sci-Fi', emoji: '🚀', color: 'from-cyan-500 to-blue-500' },
                      { name: 'Romance', emoji: '💕', color: 'from-pink-500 to-rose-500' },
                    ].map((genre, index) => (
                      <motion.div
                        key={genre.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className={styles.genreCard}
                        onClick={() => handleSearch(genre.name)}
                      >
                        <div className={`${styles.genreBackground} bg-gradient-to-br ${genre.color}`} />
                        <div className={styles.genreContent}>
                          <div className={styles.genreEmoji}>{genre.emoji}</div>
                          <div className={styles.genreName}>{genre.name}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Popular TV Shows */}
              {popularTV.length > 0 && (
                <section className={styles.section}>
                  <CategoryRow
                    title="📺 Popular TV Shows"
                    items={popularTV}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* Trending This Week */}
              {trendingWeek.length > 0 && (
                <section className={styles.section}>
                  <CategoryRow
                    title="📈 Trending This Week"
                    items={trendingWeek}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* Features Showcase */}
              <section className={styles.featuresShowcase}>
                <div className="container mx-auto px-4">
                  <h2 className={styles.sectionTitle}>✨ Why Choose FlyX?</h2>
                  <div className={styles.featuresGrid}>
                    <motion.div
                      className={styles.featureCard}
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <div className={styles.featureIconLarge}>🎯</div>
                      <h3>Smart Recommendations</h3>
                      <p>AI-powered suggestions based on your viewing history and preferences</p>
                    </motion.div>
                    <motion.div
                      className={styles.featureCard}
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <div className={styles.featureIconLarge}>⚡</div>
                      <h3>Instant Streaming</h3>
                      <p>Lightning-fast loading with adaptive quality for your connection</p>
                    </motion.div>
                    <motion.div
                      className={styles.featureCard}
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <div className={styles.featureIconLarge}>📱</div>
                      <h3>Multi-Device Sync</h3>
                      <p>Start on your phone, continue on your TV - seamlessly</p>
                    </motion.div>
                  </div>
                </div>
              </section>

              {/* All Trending Content Grid with Infinite Scroll */}
              {(trendingWeek.length > 0 || additionalContent.length > 0) && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>🌟 Discover More</h2>
                  <ContentGrid
                    items={[...trendingWeek, ...additionalContent]}
                    onItemClick={handleContentClick}
                    virtualScroll={true}
                  />
                </section>
              )}

              {/* Call to Action */}
              <section className={styles.ctaSection}>
                <ParallaxContainer height="h-auto" className="py-20">
                  <div className="container mx-auto px-4 text-center">
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8 }}
                    >
                      <h2 className={styles.ctaTitle}>Ready to Start Watching?</h2>
                      <p className={styles.ctaSubtitle}>
                        Join millions of users enjoying unlimited entertainment
                      </p>
                      <div className={styles.ctaButtons}>
                        <FluidButton
                          variant="primary"
                          size="lg"
                          onClick={() => handleSearch('trending')}
                        >
                          🚀 Start Exploring
                        </FluidButton>
                        <FluidButton
                          variant="secondary"
                          size="lg"
                          onClick={() => router.push('/about')}
                        >
                          📖 Learn More
                        </FluidButton>
                      </div>
                    </motion.div>
                  </div>
                </ParallaxContainer>
              </section>

              {/* Infinite Scroll Trigger */}
              <div ref={loadMoreRef} className={styles.loadMoreTrigger}>
                {isLoading && (
                  <div className={styles.loadingIndicator}>
                    <div className={styles.spinner} />
                    <p>Loading more content...</p>
                  </div>
                )}
                {!hasMore && additionalContent.length > 0 && (
                  <p className={styles.endMessage}>You've reached the end!</p>
                )}
              </div>
            </main>
          </>
        )}

        <Footer />
      </div>
    </PageTransition>
  );
}
