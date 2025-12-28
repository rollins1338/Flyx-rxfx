import { Metadata } from 'next';
import LiveTVRefactored from './LiveTVRefactored';

export const metadata: Metadata = {
  title: 'Live TV - Flyx | Live Sports & Events',
  description: 'Watch live sports, PPV events, and TV channels. Stream NFL, NBA, UFC, Soccer, and more ad-free on Flyx.',
  keywords: ['live tv', 'live sports', 'streaming', 'nfl', 'nba', 'ufc', 'soccer', 'ppv', 'flyx'],
  openGraph: {
    title: 'Live TV - Flyx | Live Sports & Events',
    description: 'Watch live sports, PPV events, and TV channels. Stream NFL, NBA, UFC, Soccer, and more ad-free.',
    url: 'https://tv.vynx.cc/livetv',
    siteName: 'Flyx 2.0',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live TV - Flyx | Live Sports & Events',
    description: 'Watch live sports, PPV events, and TV channels. Stream NFL, NBA, UFC, Soccer, and more ad-free.',
  },
};

export default function LiveTVPage() {
  return <LiveTVRefactored />;
}
