/**
 * Routes Layout with Analytics
 */

import AnalyticsProvider from '../components/analytics/AnalyticsProvider';

export default function RoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AnalyticsProvider>{children}</AnalyticsProvider>;
}
