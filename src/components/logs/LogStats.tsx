import { LogStats as LogStatsType } from '@/utils/logParser';

export type HarBucketCounts = {
  '1xx': number;
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
  other: number;
};

interface LogStatsProps {
  stats: LogStatsType;
  harBuckets?: HarBucketCounts;
}

export const LogStats = ({ stats, harBuckets }: LogStatsProps) => {
  return (
    <span className="text-sm space-x-3 inline-flex flex-wrap items-center">
      {harBuckets ? (
        <>
          <span className="text-blue-600 dark:text-blue-400">1xx: {harBuckets['1xx']}</span>
          <span className="text-green-600 dark:text-green-400">2xx: {harBuckets['2xx']}</span>
          <span className="text-amber-600 dark:text-amber-400">3xx: {harBuckets['3xx']}</span>
          <span className="text-orange-600 dark:text-orange-400">4xx: {harBuckets['4xx']}</span>
          <span className="text-red-600 dark:text-red-400">5xx: {harBuckets['5xx']}</span>
          <span className="text-gray-500 dark:text-stone-400">No response: {harBuckets.other}</span>
        </>
      ) : (
        <>
          <span className="text-sky-600 dark:text-sky-400">Info: {stats.info}</span>
          <span className="text-yellow-600 dark:text-yellow-400">Warn: {stats.warn}</span>
          <span className="text-red-600 dark:text-red-400">Error: {stats.error}</span>
        </>
      )}
    </span>
  );
};