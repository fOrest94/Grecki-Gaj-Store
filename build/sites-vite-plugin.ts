import type { Plugin } from "vite";

/**
 * Minimal, functional stand-in for the sites Vite plugin.
 *
 * The original implementation of this plugin is not part of this
 * repository. This placeholder keeps the Vite pipeline unblocked by
 * exposing a valid plugin object that performs no additional
 * transformations. Replace with the real implementation as needed.
 */
export function sites(): Plugin {
  return {
    name: "sites-vite-plugin",
  };
}

export default sites;
