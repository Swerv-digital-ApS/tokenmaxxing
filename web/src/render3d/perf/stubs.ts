/** Just enough of a browser for the kit's painted textures to be "built" without one (tests, `scripts/perf/counts.ts`). */
export function installHeadlessGlobals(): void {
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === "canvas"
          ? {}
          : k === "getImageData"
            ? (_x: number, _y: number, w: number, h: number) => ({
                data: new Uint8ClampedArray(w * h * 4),
                width: w,
                height: h,
              })
            : () => ({ addColorStop() {} }),
      set: () => true,
    },
  );
  const fake = { width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {} };
  Object.assign(globalThis, {
    Image: class {
      onload?: () => void;
      set src(_v: string) {}
    },
    document: { createElement: () => ({ ...fake }), body: { append() {} }, addEventListener() {} },
    window: globalThis,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: "" },
    navigator: { userAgent: "bun" },
  });
}
