import { describe, expect, it } from 'vitest';
import { Camera, MAX_ZOOM } from './camera';

describe('Camera', () => {
  it('convertit écran ↔ monde', () => {
    const cam = new Camera();
    cam.x = 100;
    cam.y = 50;
    cam.zoom = 2;
    expect(cam.toScreen({ x: 10, y: 10 })).toEqual({ x: 120, y: 70 });
    expect(cam.toWorld({ x: 120, y: 70 })).toEqual({ x: 10, y: 10 });
  });

  it('zoome autour du point visé, qui reste immobile', () => {
    const cam = new Camera();
    const p = { x: 300, y: 200 };
    const before = cam.toWorld(p);
    cam.zoomAt(p, 1.7);
    const after = cam.toWorld(p);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('borne le zoom', () => {
    const cam = new Camera();
    cam.zoomAt({ x: 0, y: 0 }, 1000);
    expect(cam.zoom).toBe(MAX_ZOOM);
  });

  it('centre la boîte dans la vue', () => {
    const cam = new Camera();
    cam.fit({ minX: 0, minY: 0, maxX: 200, maxY: 100 }, 800, 600);
    const c = cam.toScreen({ x: 100, y: 50 });
    expect(c.x).toBeCloseTo(400);
    expect(c.y).toBeCloseTo(300);
  });
});
