




let core: Promise<void> | null = null;

/**
 * Live2D Cubism Core for Web (`live2dcubismcore.min.js`), which defines the global the player uses. It is Live2D's own
 * software under its own license, loaded once from `url` as a classic script; a failed load can be tried again.
 */
export function loadCubismCore(url: string): Promise<void> {
  core ??= new Promise<void>((resolve, reject) => {
    if ("Live2DCubismCore" in window) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.addEventListener("load", () => ("Live2DCubismCore" in window ? resolve() : reject(new Error(`${url} did not define Live2DCubismCore`))));
    script.addEventListener("error", () => {
      script.remove();
      reject(new Error(`Live2D Cubism Core could not be loaded from ${url}`));
    });
    document.head.append(script);
  }).catch((error: unknown) => {
    core = null;
    throw error;
  });
  return core;
}



