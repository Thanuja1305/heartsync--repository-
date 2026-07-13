import { useEffect, useRef } from 'react';

export const useAIAnalyst = (userId: string | undefined, metrics: any) => {
  const lastAnalysisTime = useRef<number>(0);
  const isAnalyzing = useRef<boolean>(false);

  useEffect(() => {
    if (!userId || !metrics) return;

    const now = Date.now();
    // Analyze every 1 minute (60,000 ms)
    if (now - lastAnalysisTime.current < 60000 || isAnalyzing.current) return;

    const runAnalysis = async () => {
      isAnalyzing.current = true;
      try {
        console.info("🧠 AI Analyst: Starting periodic health review...");
        
        const response = await fetch("/api/analyze-metrics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ userId, metrics })
        });

        if (!response.ok) {
          throw new Error("Analysis request failed");
        }

        await response.json();
        lastAnalysisTime.current = Date.now();
        console.info("✅ AI Analyst: Periodic review completed securely via server and synced.");
      } catch (error) {
        console.error("❌ AI Analyst Error:", error);
      } finally {
        isAnalyzing.current = false;
      }
    };

    runAnalysis();
  }, [userId, metrics]);
};
