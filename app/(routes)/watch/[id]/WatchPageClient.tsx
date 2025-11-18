'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from './WatchPage.module.css';

const VideoPlayer = dynamic(
  () => import('../../../components/player/VideoPlayer'),
  { 
    ssr: false,
    loading: () => (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading player...</p>
      </div>
    )
  }
);

function WatchContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const contentId = params.id as string;
  const mediaType = searchParams.get('type') as 'movie' | 'tv';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  const titleParam = searchParams.get('title') || searchParams.get('name');
  
  // Decode title if it exists
  const title = titleParam ? decodeURIComponent(titleParam) : 'Loading...';
  
  const seasonId = season ? parseInt(season) : undefined;
  const episodeId = episode ? parseInt(episode) : undefined;

  const handleBack = () => {
    router.back();
  };

  if (!contentId || !mediaType) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Invalid Content</h2>
          <p>Missing content ID or media type.</p>
          <button onClick={handleBack} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (mediaType === 'tv' && (!seasonId || !episodeId)) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Invalid Episode</h2>
          <p>Missing season or episode information.</p>
          <button onClick={handleBack} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.playerWrapper}>
        <button onClick={handleBack} className={styles.backButtonOverlay}>
          ← Back
        </button>
        
        <VideoPlayer
          tmdbId={contentId}
          mediaType={mediaType}
          season={seasonId}
          episode={episodeId}
          title={title}
        />
      </div>
    </div>
  );
}

export default function WatchPageClient() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading...</p>
        </div>
      </div>
    }>
      <WatchContent />
    </Suspense>
  );
}
