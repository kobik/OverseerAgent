import { Hono } from 'hono';
import { MediaIntent, extractMediaIntent } from '../services/mediaIntentService.js';
import { searchOverseerr, requestMedia, getRadarrProfiles, getSonarrProfiles, fetchMediaInfo } from '../services/overseerrService.js';

const router = new Hono();

router.post("/prompt", async (c) => {
  try {
    const { prompt } = await c.req.json<{ prompt: string }>();

    if (!prompt) {
      return c.json({ error: "Prompt is required" }, 400);
    }

    const radarrProfiles = await getRadarrProfiles();
    const sonarrProfiles = await getSonarrProfiles();

    let intent: MediaIntent = await extractMediaIntent(prompt, radarrProfiles, sonarrProfiles);
    console.log("🎯 Extracted:", intent);

    let searchResults = await searchOverseerr(intent.title);
    if (!searchResults) {
      return c.json({ error: "Media not found" }, 404);
    }

    const status = searchResults.mediaInfo?.status;
    if (status === 5) { 
      console.log("✅ Media already available/requested or processing");
      return c.json({
        status: "already_processed", // Generalized status
        message: "This media is already processing, available, or has been requested.",
      });
    }

    // If partially available, check if requested seasons are among the available ones
    if (intent.mediaType === "tv") {
      const requiredSeasons = getRequiredSeasons(intent, searchResults.mediaInfo?.seasons || []);

      if (requiredSeasons.length === 0) {
        console.log("✅ All requested seasons are already available/requested or processing");
        return c.json({
          status: "already_processed",
          message: "All requested seasons are already available, processing, or requested.",
        });
      }
      // Update intent to only request missing seasons
      intent.seasons = requiredSeasons;
    }

    const requested = await requestMedia(intent, searchResults.id);
    console.log("📥 Media requested successfully:", requested);
    return c.json({ status: "success", intent });
  } catch (err: unknown) {
    console.error("❌ Prompt Route Error:", err instanceof Error ? err.message : String(err));
    // Check if the error is from one of our services and rethrow if it's a specific message
    if (err instanceof Error) {
      if (err.message === "Failed to extract media intent" || 
          err.message === "Failed to search Overseerr" || 
          err.message === "Failed to request media") {
        return c.json({ error: err.message }, 500); 
      }
    }
    return c.json({ error: "Server failed to process prompt" }, 500);
  }
});

function getRequiredSeasons(intent: MediaIntent, seasons: { seasonNumber: number; status?: number }[]): number[] {
  if (intent.seasons === 'all') {
    return seasons
      .map(s => s.seasonNumber)
      .filter(s => s > 0)
      .sort((a, b) => a - b);
  } else if (intent.seasons === 'first') {
    return [1];
  } else if (intent.seasons === 'last') {
    return [seasons.at(-1)?.seasonNumber || 1];
  } else if (intent.seasons === 'next') {
    return [seasons
      .sort((a, b) => a.seasonNumber - b.seasonNumber)
      .find(s => s.status !== 5)
      ?.seasonNumber || 1];
  } else if (Array.isArray(intent.seasons)) {
    return intent.seasons;
  }
  return [1];
}

export default router; 