import { describe, expect, it } from "vitest";
import { matchPlayer, parseList } from "../whatsapp-list";

const NAMES = ["Duarte Gonçalves", "Zé Vieira", "Daniel Miranda", "Caniço", "Nando", "Christophe", "Tiago Azevedo", "Moura",
  "Rui Silva", "Barroso", "João Vale", "Hernâni", "Nelson Peixoto", "Bruninho", "Philippe", "Fábio", "Torres", "André Leite",
  "Mário", "Paulo Araújo", "Reis", "Lucas", "Tiago Lourenço", "JP Carvalho", "Castanheira", "Hugassi", "Zé Pedro Martins",
  "Hélder Miranda", "Comendador", "Pedró", "PAC", "Pli", "João Pereira", "Miguel Almeida", "Benjamim", "Duarte Coelho",
  "Taipas", "Labareda", "Matheus", "André Dantas", "João Sousa", "Alex", "Baba", "Borges", "Canhão", "Davide", "French",
  "Hugo Lima", "Incio", "Jorge Costa", "Pachita", "Plácido", "Rodrigo", "Tiago Carvalho", "Vicente", "Zé Macedo"];
const players = NAMES.map((name) => ({ name }));

const LIST = `🎾 Moura🏆/Christophe🏆🤡 
🎾 Taipas🥁 
🎾 Caniço 

🎾 Azevedo
🎾 T. Lourenço 
🎾 ZP Martins 
🎾 Pli 

🎾 Mário 
🎾 Vale
🎾 Peixoto
🎾 JPC

🎾 Nando
🎾 Barroso
🎾 Pachita
🎾 Philippe

🎾 Alex
🎾 Vicente
🎾 Figueiredo (wc)
🎾 Helder M. (wc)
`;

describe("WhatsApp list", () => {
  it("reads names, fixed pairs, joker and wild cards", () => {
    const lines = parseList(LIST);
    expect(lines.flatMap((l) => l.names)).toHaveLength(20);
    expect(lines[0]).toMatchObject({ reason: "winners" });
    expect(lines[0]!.names.map((n) => [n.text, n.joker])).toEqual([["Moura", false], ["Christophe", true]]);
    expect(lines[1]).toMatchObject({ reason: null, names: [{ text: "Taipas" }] });
    expect(lines.at(-1)!.names[0]).toMatchObject({ text: "Helder M.", wildCard: true });
  });

  it("matches surnames, initials and abbreviations", () => {
    const got = parseList(LIST).flatMap((l) => l.names).map((n) => {
      const m = matchPlayer(n.text, players);
      return m && "player" in m ? m.player.name : null;
    });
    expect(got).toEqual(["Moura", "Christophe", "Taipas", "Caniço", "Tiago Azevedo", "Tiago Lourenço", "Zé Pedro Martins", "Pli",
      "Mário", "João Vale", "Nelson Peixoto", "JP Carvalho", "Nando", "Barroso", "Pachita", "Philippe", "Alex", "Vicente",
      null, "Hélder Miranda"]);
  });

  it("flags ambiguous names", () => {
    expect(matchPlayer("Duarte", players)).toMatchObject({ ambiguous: [{}, {}] });
  });
});
