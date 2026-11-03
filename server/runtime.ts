/**
 * Runtime guard for modules that must only execute on the server.
 *
 * This is an intentionally dependency-free first boundary. Once backend
 * dependencies are selected, server-only modules should also use the framework
 * server-only package or equivalent build-time import restriction.
 */
export function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("A CityMood server module was imported into a client bundle.");
  }
}
