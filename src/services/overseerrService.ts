import axios from 'axios';
import { OVERSEERR_URL, OVERSEERR_API_KEY, profileMap, ProfileConfig } from '../config/index.js';
import { MediaIntent } from './mediaIntentService.js'; // Assuming MediaIntent will be used here

export interface OverseerrSearchResult {
  id: number;
  mediaType: 'movie' | 'tv';
  mediaInfo?: {
    status?: number;
    seasons?: { seasonNumber: number; status?: number }[];
  };
}

const overseerrHeaders = {
  "X-Api-Key": OVERSEERR_API_KEY!,
  "Content-Type": "application/json",
};

const overseerr = axios.create({
  baseURL: OVERSEERR_URL,
  headers: overseerrHeaders,
});

export async function searchOverseerr(title: string): Promise<OverseerrSearchResult | undefined> {
  try {
    console.log("🔍 Searching Overseerr for:", title);
    const res = await overseerr.get<{results: OverseerrSearchResult[]}>(`/api/v1/search`, {
      params: { query: encodeURIComponent(title) },
    });
    const result = res.data.results[0];
    if (result.mediaType === 'tv' && !result.mediaInfo?.seasons?.length) {
      const mediaInfo = await fetchMediaInfo(result.id, 'tv');
      result.mediaInfo = {
        seasons: mediaInfo.seasons,
      };
    }
    return result;
  } catch (err: any) {
    console.error("❌ Error searching Overseerr:", err);
    throw new Error("Failed to search Overseerr");
  }
}

export async function fetchMediaInfo(mediaId: number, mediaType: string): Promise<any> {
  try {
    const res = await overseerr.get(`/api/v1/${mediaType}/${mediaId}`);
    return res.data;
  } catch (err: any) {
    console.error("❌ Error fetching media info:", err);
    throw new Error("Failed to fetch media info");
  }
}

export interface Profile {
  id: number;
  name: string;
}

export async function getRadarrProfiles(): Promise<Profile[]> {
  console.log("🔍 Getting Radarr profiles");
  const res = await overseerr.get<Profile[]>(`/api/v1/settings/radarr/0/profiles`);
  console.log("🔍 Radarr profiles:", res.data);
  return res.data;
}

export async function getSonarrProfiles(): Promise<Profile[]> {
  try {
  console.log("🔍 Getting Sonarr profiles");
  const res = await overseerr.get<Profile[]>(`/api/v1/settings/sonarr`);
  console.log("🔍 Sonarr profiles:", res.data);
  return res.data;
  } catch (err: any) {
    console.error("❌ Error getting Sonarr profiles:", err.response.data);
    throw new Error("Failed to get Sonarr profiles");
  }
}

export async function requestMedia(intent: MediaIntent, mediaId: number): Promise<unknown> {
  const mediaType = intent.mediaType;

  interface RequestPayload {
    mediaType: string;
    mediaId: number;
    tvdbId?: number;
    profileId?: number;
    seasons?: number[];
  }

  const payload: RequestPayload = {
    mediaType,
    mediaId,
    profileId: intent.profile?.id,
  };

  if (mediaType === 'tv') {
    payload.tvdbId = mediaId;
    payload.seasons = intent.seasons as number[];
  }

  console.log("📦 Requesting media with payload:", payload);
  try {
    const res = await axios.post(
      `${OVERSEERR_URL}/api/v1/request`,
      payload,
      { headers: overseerrHeaders }
    );
    if (!res.data) {
      throw new Error("Invalid response from Overseerr API");
    }
    return res.data;
  } catch (err: unknown) {
    console.error("❌ Error requesting media:", err instanceof Error ? err.message : String(err));
    throw new Error("Failed to request media");
  }
}