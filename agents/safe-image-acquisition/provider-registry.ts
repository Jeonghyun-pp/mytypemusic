import type { ImageProvider } from "./provider.js";
import { PressRoomProvider } from "./providers/pressroom.js";
import { SpotifyProvider } from "./providers/spotify.js";
import { UnsplashProvider } from "./providers/unsplash.js";
import { PexelsProvider } from "./providers/pexels.js";
import { AIGenerationProvider } from "./providers/ai-generation.js";

export class ProviderRegistry {
  private providers: Map<string, ImageProvider> = new Map();
  private insertionOrder: string[] = [];

  constructor(providers: ImageProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.name)) {
        throw new Error(
          `Duplicate provider name: "${provider.name}" is already registered`
        );
      }
      this.providers.set(provider.name, provider);
      this.insertionOrder.push(provider.name);
    }
  }

  getProviders(): ImageProvider[] {
    return this.insertionOrder.map((name) => this.providers.get(name)!);
  }

  getProviderByName(name: string): ImageProvider | undefined {
    return this.providers.get(name);
  }
}

export function createDefaultRegistry(): ProviderRegistry {
  return new ProviderRegistry([
    new PressRoomProvider(),
    new SpotifyProvider(),
    new UnsplashProvider(),
    new PexelsProvider(),
    new AIGenerationProvider(),
  ]);
}
