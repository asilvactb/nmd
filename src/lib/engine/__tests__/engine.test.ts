import { describe, expect, it } from "vitest";
import { eventPoints, placementPoints } from "../scoring";
import { generatePairs } from "../pairing";
import { directCrossFormat, finalPlaces, finalsOnlyFormat, formatFor, groupFixtures, groupStandings, validateScore } from "../tournament";
import type { Player } from "../types";

// Deterministic RNG for tests
const seeded = (seed = 42) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe("scoring (matches the Inverno 2026/27 spreadsheet)", () => {
  it("10 pairs: winner 10, last 1", () => {
    const pts = placementPoints(10, Array.from({ length: 10 }, (_, i) => ({ players: ["x", "y"], position: i + 1 })));
    expect(pts[0]).toBe(10);
    expect(pts[9]).toBe(1);
  });

  it("shared 3rd/4th with 10 pairs = 7.5 (04/out, Duarte G. and Christophe)", () => {
    const pts = placementPoints(10, [
      { players: ["a", "b"], position: 3 },
      { players: ["c", "d"], position: 3 },
    ]);
    expect(pts).toEqual([7.5, 7.5]);
  });

  it("Duarte Gonçalves season total = 41.5", () => {
    const total = [
      placementPoints(6, [{ players: ["d", "x"], position: 5 }])[0],
      placementPoints(10, [{ players: ["d", "x"], position: 4 }])[0],
      placementPoints(10, [{ players: ["d", "x"], position: 3 }, { players: ["y", "z"], position: 3 }])[0],
      placementPoints(8, [{ players: ["d", "x"], position: 1 }])[0],
      placementPoints(12, [{ players: ["d", "x"], position: 3 }])[0],
      placementPoints(10, [{ players: ["d", "x"], position: 4 }])[0],
    ].reduce((a, b) => a! + b!, 0);
    expect(total).toBe(41.5);
  });

  it("joker doubles the winner (Zé Vieira 18/out: 12 x 2) and halves the rest", () => {
    const res = eventPoints(12, [
      { players: ["zv", "al"], position: 1 },
      { players: ["dm", "ma"], position: 7 },
    ], new Set(["zv", "dm"]));
    expect(res.find((r) => r.playerId === "zv")?.final).toBe(24);
    expect(res.find((r) => r.playerId === "al")?.final).toBe(12);
    expect(res.find((r) => r.playerId === "dm")?.final).toBe(3);
  });
});

const P = (id: string, side: "L" | "R", strength: number, isWildCard = false): Player => ({
  id, name: id, side, strength, isWildCard,
});

describe("pairing", () => {
  it("best right with worst left and vice-versa", () => {
    const res = generatePairs({
      players: [P("L1", "L", 40), P("L2", "L", 30), P("L3", "L", 20), P("L4", "L", 10),
                P("R1", "R", 35), P("R2", "R", 25), P("R3", "R", 15), P("R4", "R", 5)],
    });
    const names = res.pairs.map((p) => `${p.left.id}/${p.right.id}`).sort();
    expect(names).toEqual(["L1/R4", "L2/R3", "L3/R2", "L4/R1"]);
  });

  it("fixed pairs go first; a missing partner sends the other to the pool", () => {
    const res = generatePairs({
      players: [P("L1", "L", 40), P("L2", "L", 30), P("R1", "R", 35), P("R2", "R", 25)],
      fixedPairs: [{ a: "L2", b: "R1", reason: "bombos" }, { a: "L1", b: "GONE", reason: "winners" }],
    });
    expect(res.pairs[0]).toMatchObject({ left: { id: "L2" }, right: { id: "R1" }, reason: "bombos" });
    expect(res.pairs[1]).toMatchObject({ left: { id: "L1" }, right: { id: "R2" } });
  });

  it("wild cards go with the best-ranked members", () => {
    const res = generatePairs({
      players: [P("WC", "L", 50, true), P("L2", "L", 30), P("R1", "R", 35), P("R2", "R", 5)],
    });
    expect(res.pairs.find((p) => p.left.id === "WC")?.right.id).toBe("R1");
  });

  it("avoids pairs from the last 4 encounters", () => {
    const res = generatePairs({
      players: [P("L1", "L", 40), P("L2", "L", 30), P("R1", "R", 35), P("R2", "R", 25)],
      recentPairs: [["L1", "R2"]],
    });
    expect(res.pairs.map((p) => `${p.left.id}/${p.right.id}`).sort()).toEqual(["L1/R1", "L2/R2"]);
    expect(res.warnings).toHaveLength(0);
  });

  it("relaxes the rule with a warning when impossible", () => {
    const res = generatePairs({
      players: [P("L1", "L", 40), P("R1", "R", 35)],
      recentPairs: [["L1", "R1"]],
    });
    expect(res.pairs).toHaveLength(1);
    expect(res.warnings[0]).toContain("L1/R1");
  });

  it("side imbalance: draw among the larger side", () => {
    const res = generatePairs({
      players: [P("L1", "L", 40), P("L2", "L", 30), P("L3", "L", 20), P("R1", "R", 35)],
      rng: seeded(),
    });
    expect(res.sideSwitches).toHaveLength(1);
    expect(res.sideSwitches[0]!.how).toBe("draw");
    expect(res.pairs).toHaveLength(2);
  });

  it("volunteers switch before the draw", () => {
    const res = generatePairs({
      players: [P("L1", "L", 40), P("L2", "L", 30), P("L3", "L", 20), P("R1", "R", 35)],
      volunteers: ["L3"],
    });
    expect(res.sideSwitches).toEqual([{ playerId: "L3", from: "L", to: "R", how: "volunteer" }]);
  });
});

describe("tournament", () => {
  it("scores: one set to 6, 6-5 is the tie-break", () => {
    expect(validateScore({ a: 6, b: 5 })).toBeNull();
    expect(validateScore({ a: 6, b: 6 })).not.toBeNull();
    expect(validateScore({ a: 5, b: 4 })).not.toBeNull();
  });

  it("group of 5 fixtures follow the spreadsheet (each pair plays 4)", () => {
    const fx = groupFixtures(["1", "2", "3", "4", "5"]).flat();
    expect(fx).toHaveLength(10);
    for (const id of ["1", "2", "3", "4", "5"]) expect(fx.filter((m) => m.includes(id))).toHaveLength(4);
  });

  it("reproduces 25/out group A order and knockout slots", () => {
    // Group A of 25/out: MC = Moura/Christophe, HM = Hernâni/Mário, CB = Caniço/Bruninho,
    // AZ = André Leite/Zé Vieira, PV = Paulo A./Vale
    const ids = ["AZ", "CB", "MC", "HM", "PV"];
    const r = (a: string, b: string, sa: number, sb: number) => ({ a, b, score: { a: sa, b: sb } });
    const table = groupStandings(ids, [
      r("AZ", "CB", 3, 6), r("MC", "HM", 6, 5),
      r("AZ", "MC", 3, 6), r("CB", "PV", 6, 5),
      r("AZ", "PV", 6, 4), r("CB", "HM", 3, 6),
      r("AZ", "HM", 2, 6), r("MC", "PV", 6, 1),
      r("HM", "PV", 6, 3), r("CB", "MC", 4, 6),
    ]);
    expect(table.map((t) => t.pairId)).toEqual(["MC", "HM", "CB", "AZ", "PV"]);
    expect(table[0]).toMatchObject({ wins: 4, delta: 11 });
  });

  it("10 pairs: knockout gives every place 1..10", () => {
    const f = formatFor(10);
    const groupOrder = { A: ["a1", "a2", "a3", "a4", "a5"], B: ["b1", "b2", "b3", "b4", "b5"] };
    const ko = {
      P5: { winner: "a3", loser: "b3" },
      MF1: { winner: "a1", loser: "b2" }, MF2: { winner: "b1", loser: "a2" },
      MB1: { winner: "a4", loser: "b5" }, MB2: { winner: "b4", loser: "a5" },
      F: { winner: "a1", loser: "b1" }, P3: { winner: "b2", loser: "a2" },
      P7: { winner: "a4", loser: "b4" }, FB: { winner: "b5", loser: "a5" },
    };
    const places = finalPlaces(f, groupOrder, ko);
    expect([...places.values()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(places.get("a5")).toBe(10); // bombos
  });

  it("direct cross variant: 1st v 1st ... last v last", () => {
    const f = directCrossFormat(formatFor(8));
    expect(f.knockout.map((k) => k.places)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8]]);
  });

  it("10 pairs without time: only finals, the rest share places by group position (4 Oct)", () => {
    const f = finalsOnlyFormat(formatFor(10));
    expect(f.knockout.map((k) => k.id)).toEqual(["F", "FB"]);
    const groupOrder = { A: ["a1", "a2", "a3", "a4", "a5"], B: ["b1", "b2", "b3", "b4", "b5"] };
    const places = finalPlaces(f, groupOrder, { F: { winner: "b1", loser: "a1" }, FB: { winner: "a5", loser: "b5" } });
    expect(places.get("b1")).toBe(1);
    expect(places.get("a2")).toBe(3);
    expect(places.get("b2")).toBe(3);
    expect(places.get("a4")).toBe(7);
    expect(places.get("b5")).toBe(10);
    const pts = placementPoints(10, [...places].map(([id, position]) => ({ players: [id, id] as [string, string], position })));
    expect(pts[[...places.keys()].indexOf("a2")]).toBe(7.5);
  });
});
