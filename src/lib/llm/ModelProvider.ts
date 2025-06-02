/**
 * Base class for LLM providers
 * Defines the interface that all LLM providers must implement
 */

import { Profile } from "../../services/overseerrService.js";

export interface MediaIntent {
  title: string;
  mediaType: "movie" | "tv";
  seasons?: "all" | number[];
  profile?: {
    id: number;
    name: string;
  };
}

class ModelProvider {
  protected apiKey: string | undefined;

  constructor(apiKey?: string) {
    if (this.constructor === ModelProvider) {
      throw new Error("ModelProvider is an abstract class and cannot be instantiated directly");
    }
    this.apiKey = apiKey;
  }

  /**
   * Generate a response from the LLM for media intent extraction
   * @param {string} prompt - The user's input prompt
   * @returns {Promise<MediaIntent>} - Parsed JSON response containing media intent
   * @throws {Error} - If the API call fails or response cannot be parsed
   */
  async generateResponse(_userPrompt: string, radarrProfiles: Profile[], sonarrProfiles: Profile[]): Promise<MediaIntent> {
    throw new Error("generateResponse method must be implemented by subclass");
  }

  /**
   * Get the system prompt for media intent extraction
   * Each provider can customize this for optimal performance
   * @returns {string} - The system prompt
   */
  getSystemPrompt(radarrProfiles: Profile[], sonarrProfiles: Profile[]): string {
    return `You're an assistant that extracts media request information from user prompts.

You have the following movie profiles available:
${radarrProfiles.map(p => `- ${p.name} (${p.id})`).join("\n")}

You have the following TV show profiles available:
${sonarrProfiles.map(p => `- ${p.name} (${p.id})`).join("\n")}

Analyze the prompt and return a JSON object with the following structure:
{
  "title": "exact title of the movie/show",
  "mediaType": "movie" or "tv",
  "seasons": "all" or [1,2,3] (array of season numbers, only for TV shows),
  "profile": the requested profile ONLY if the user explicitly requests a specific profile and matching only existing profiles according to the profiles above and media type. if you haven't found a matching profile, return null.
}

Examples:
- "I want to watch Breaking Bad season 1" → {"title": "Breaking Bad", "mediaType": "tv", "seasons": [1]}
- "Add all seasons of Friends" → {"title": "Friends", "mediaType": "tv", "seasons": "all"}
- "My wife wanna watch Grey's Anatomy" → {"title": "Grey's Anatomy", "mediaType": "tv", "seasons": "first"}
- "Add Grey's Anatomy" → {"title": "Grey's Anatomy", "mediaType": "tv", "seasons": "first"}
- "id like to watch The Witcher tv show in hd → {"title": "The Witcher", "mediaType": "tv", "seasons": "first", "profile": {id: 1, name: "hd"}}
- "Let's watch the first season of SpongeBob" → {"title": "SpongeBob", "mediaType": "tv", "seasons": "first"}
- "Let's watch the next season of SpongeBob" → {"title": "SpongeBob", "mediaType": "tv", "seasons": "next"}
- "Let's watch the latest season of SpongeBob" → {"title": "SpongeBob", "mediaType": "tv", "seasons": "last"}
- "Watch the newest season of The Simpsons" → {"title": "The Simpsons", "mediaType": "tv", "seasons": "last"}
- "I need the Hebrew movie Lebanon" → {"title": "Lebanon", "mediaType": "movie", "profile": {id: 1, name: "Heb"}}
- "I need the Hebrew Dubbed Kung Fu Panda 2" → {"title": "Kung Fu Panda 2", "mediaType": "movie", "profile": {id: 1, name: "HebDub"}}
- "I want to watch Breaking Bad season 1 in 4k" → {"title": "Breaking Bad", "mediaType": "tv", "seasons": [1], "profile": {id: 1, name: "UltraHD"}}
- "I want to watch Breaking Bad season 1 in Ultra HD" → {"title": "Breaking Bad", "mediaType": "tv", "seasons": [1], "profile": {id: 1, name: "UltraHD"}}
- "Watch seasons 1-3 of The Simpsons" → {"title": "The Simpsons", "mediaType": "tv", "seasons": [1,2,3]}

IMPORTANT: For requests asking for the "latest", "newest", or "last" season, use "last" for seasons - this indicates the system should fetch the most recent season available.
For requests asking for the "first" season, use "first" for seasons.
For requests asking for a specific season, use the season number.
  `}
  
  /**
   * Validate that the response is a valid JSON object with expected structure
   * @param {string} responseText - Raw response text from LLM
   * @returns {MediaIntent} - Validated and parsed JSON object
   * @throws {Error} - If response is invalid or missing required fields
   */
  validateResponse(responseText: string): MediaIntent {
    let parsed: MediaIntent;
    try {
      parsed = JSON.parse(responseText.trim());
    } catch (err: unknown) {
      throw new Error(`Invalid JSON response from LLM: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Validate required fields
    if (!parsed.title || !parsed.mediaType) {
      throw new Error("Response missing required fields: title and mediaType");
    }

    if (!["movie", "tv"].includes(parsed.mediaType as string)) {
      throw new Error("Invalid mediaType: must be 'movie' or 'tv'");
    }
    
    // Ensure seasons is valid if present
    if (parsed.seasons && parsed.mediaType === "movie") {
        throw new Error("Seasons should not be specified for mediaType 'movie'")
    }

    if (parsed.seasons && parsed.mediaType === "tv" && !(typeof parsed.seasons === "string" && ["all", "first", "last", "next"].includes(parsed.seasons)) && !(Array.isArray(parsed.seasons) && parsed.seasons.every((s: number) => typeof s === "number"))) {
        throw new Error("Invalid seasons format for mediaType 'tv'. Should be 'all' or an array of numbers.");
    }

    // TODO: validate the profile matches the media type profiles
    // if (parsed.profile) {
    //     throw new Error("Invalid profile value. Should be 'heb' or null/undefined.");
    // }

    // After validation, we know the parsed object conforms to MediaIntent
    return parsed;
  }
}

export default ModelProvider; 