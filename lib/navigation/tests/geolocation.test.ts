import { describe, expect, it, vi } from "vitest";
import { isCampusLocation, isFreshLocation, watchCurrentLocation } from "../geolocation";

function provider() {
  let success!: PositionCallback;
  let failure!: PositionErrorCallback;
  const geo = {
    watchPosition: vi.fn((ok: PositionCallback, error: PositionErrorCallback) => {
      success = ok; failure = error; return 0;
    }),
    clearWatch: vi.fn(),
  } as unknown as Geolocation;
  return { geo, emit: (latitude = -37.908, timestamp = Date.now()) => success({ coords: { latitude, longitude: 145.138, accuracy: 12 }, timestamp } as GeolocationPosition), fail: (code: number) => failure({ code } as GeolocationPositionError) };
}

describe("optional current location", () => {
  it("does not use an off-campus position as a campus route start", () => {
    expect(isCampusLocation({ latitude: -37.908, longitude: 145.138, accuracy: 12, timestamp: Date.now() })).toBe(true);
    expect(isCampusLocation({ latitude: -37.81, longitude: 144.96, accuracy: 12, timestamp: Date.now() })).toBe(false);
  });
  it("delivers movement updates and reports accuracy", () => {
    const p = provider(); const update = vi.fn();
    const stop = watchCurrentLocation(p.geo, update, vi.fn());
    p.emit(); p.emit(-37.909);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1][0]).toMatchObject({ latitude: -37.909, accuracy: 12 });
    stop();
    expect(p.geo.clearWatch).toHaveBeenCalledWith(0);
  });
  it("ignores queued callbacks after stopping and clears only once", () => {
    const p = provider(); const update = vi.fn(); const error = vi.fn();
    const stop = watchCurrentLocation(p.geo, update, error);
    stop(); stop(); p.emit(); p.fail(1);
    expect(update).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
    expect(p.geo.clearWatch).toHaveBeenCalledTimes(1);
  });
  it.each([1, 2, 3])("stops and explains geolocation error %s", (code) => {
    const p = provider(); const update = vi.fn(); const error = vi.fn();
    watchCurrentLocation(p.geo, update, error); p.fail(code); p.emit();
    expect(error).toHaveBeenCalledOnce(); expect(update).not.toHaveBeenCalled();
    expect(p.geo.clearWatch).toHaveBeenCalledWith(0);
  });
  it("rejects outdated and invalid samples", () => {
    const p = provider(); const update = vi.fn(); const error = vi.fn();
    watchCurrentLocation(p.geo, update, error); p.emit(-37.908, Date.now() - 31_000);
    expect(update).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledOnce();
    expect(isFreshLocation({ latitude: 91, longitude: 145, accuracy: 1, timestamp: Date.now() })).toBe(false);
    expect(isFreshLocation({ latitude: 0, longitude: 0, accuracy: 0, timestamp: 1000 }, 1000)).toBe(true);
  });
  it("handles browsers throwing before a watch is registered", () => {
    const p = provider(); vi.mocked(p.geo.watchPosition).mockImplementation(() => { throw new Error("disabled"); });
    const error = vi.fn(); watchCurrentLocation(p.geo, vi.fn(), error)();
    expect(error).toHaveBeenCalledOnce(); expect(p.geo.clearWatch).not.toHaveBeenCalled();
  });
});
