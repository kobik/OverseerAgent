import { invokeChatModel } from "../lib/llm/index.js";
import { Profile } from "./overseerrService.js";

export interface MediaIntent {
  title: string;
  mediaType: "movie" | "tv";
  seasons?: "all" | "first" | "last" | "next" | number[];
  profile?: {
    id: number;
    name: string;
  };
}

export async function extractMediaIntent(prompt: string, radarrProfiles: Profile[], sonarrProfiles: Profile[]): Promise<MediaIntent> {
  try {
    return await invokeChatModel(prompt, radarrProfiles, sonarrProfiles);
  } catch (err: any) {
    console.error("❌ Error extracting media intent:", err);
    throw new Error("Failed to extract media intent");
  }
} 

