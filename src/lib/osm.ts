/**
 * OpenStreetMap (Overpass API) Mirror List
 * Using multiple mirrors for redundancy and load balancing.
 */
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

/**
 * Fetches data from Overpass API with mirrors and retry logic
 * @param query The Overpass QL query
 * @param retries Number of retries per mirror
 */
export async function fetchFromOverpass(query: string, retries: number = 2): Promise<any> {
    const encodedQuery = encodeURIComponent(query);
    
    for (const mirror of OVERPASS_MIRRORS) {
        let attempts = 0;
        while (attempts < retries) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                const response = await fetch(`${mirror}?data=${encodedQuery}`, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (response.ok) {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        return await response.json();
                    }
                }
                
                if (response.status === 429) {
                    // Too many requests - wait and retry
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else if (response.status >= 500) {
                    // Server error - try next mirror or retry
                    console.warn(`Overpass Mirror ${mirror} failed with ${response.status}. Attempting fallback...`);
                    break; // break inner loop to try next mirror
                }
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.warn(`Overpass Mirror ${mirror} timed out.`);
                } else {
                    console.warn(`Overpass Mirror ${mirror} network error:`, error.message);
                }
                break; // try next mirror
            }
            attempts++;
        }
    }
    
    throw new Error("All Overpass API mirrors failed or timed out.");
}
