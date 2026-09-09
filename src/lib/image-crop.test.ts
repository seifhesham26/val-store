import { describe, expect, it } from "vitest";
import { MAX_CROP_EDGE, resolveCropDraw } from "./image-crop";

describe("resolveCropDraw", () => {
  it("produces a 3:4 canvas from a 3:4 crop of a wide source", () => {
    const draw = resolveCropDraw(
      { width: 2040, height: 528 },
      { x: 822, y: 0, width: 396, height: 528 },
      MAX_CROP_EDGE
    );

    expect(draw.scale).toBe(1);
    expect(draw.canvas).toEqual({ width: 396, height: 528 });
    expect(draw.canvas.width / draw.canvas.height).toBeCloseTo(0.75, 5);
  });

  it("clamps a crop that runs past the source bounds", () => {
    const draw = resolveCropDraw(
      { width: 100, height: 100 },
      { x: 50, y: 50, width: 200, height: 200 },
      MAX_CROP_EDGE
    );

    expect(draw.source).toEqual({ x: 50, y: 50, width: 50, height: 50 });
    expect(draw.canvas).toEqual({ width: 50, height: 50 });
  });

  it("clamps a negative origin to zero without losing the far edge", () => {
    const draw = resolveCropDraw(
      { width: 100, height: 100 },
      { x: -10, y: -10, width: 50, height: 50 },
      MAX_CROP_EDGE
    );

    expect(draw.source).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it("scales down a crop whose long edge exceeds maxEdge, preserving ratio", () => {
    const draw = resolveCropDraw(
      { width: 4000, height: 5000 },
      { x: 0, y: 0, width: 3000, height: 4000 },
      1600
    );

    expect(draw.scale).toBeCloseTo(0.4, 5);
    expect(draw.canvas).toEqual({ width: 1200, height: 1600 });
    expect(draw.canvas.width / draw.canvas.height).toBeCloseTo(0.75, 5);
  });

  it("leaves a crop already within maxEdge at scale 1", () => {
    const draw = resolveCropDraw(
      { width: 2000, height: 2000 },
      { x: 0, y: 0, width: 600, height: 800 },
      1600
    );

    expect(draw.scale).toBe(1);
    expect(draw.canvas).toEqual({ width: 600, height: 800 });
  });

  it("rejects a source with no area", () => {
    expect(() =>
      resolveCropDraw(
        { width: 0, height: 100 },
        { x: 0, y: 0, width: 10, height: 10 },
        MAX_CROP_EDGE
      )
    ).toThrow(/source/i);
  });

  it("rejects a crop with no area rather than returning a 0x0 canvas", () => {
    expect(() =>
      resolveCropDraw(
        { width: 100, height: 100 },
        { x: 0, y: 0, width: 0, height: 10 },
        MAX_CROP_EDGE
      )
    ).toThrow(/crop/i);
  });

  it("rejects a crop that starts outside the source entirely", () => {
    expect(() =>
      resolveCropDraw(
        { width: 100, height: 100 },
        { x: 200, y: 0, width: 50, height: 50 },
        MAX_CROP_EDGE
      )
    ).toThrow(/crop/i);
  });
});
