import Head from "next/head";
import LogAnalyzer from '@/components/LogAnalyzer';

export default function Home() {
  return (
    <>
      <Head>
        <title>Log Analyser</title>
      </Head>
      <main className="min-h-screen p-4">
        <LogAnalyzer />
      </main>
    </>
  );
}