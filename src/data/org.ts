import daniel from "@/assets/daniel-opoku.jpg";
import charlotte from "@/assets/charlotte-doyly.jpg";
import kav from "@/assets/kav-pawar.jpg";
import richard from "@/assets/richard-johnson.jpg";
import maria from "@/assets/maria-amigot.jpg";
import hannah from "@/assets/hannah-savage.jpg";
import trevor from "@/assets/trevor-evans.jpg";
import lucy from "@/assets/lucy-price.jpg";
import precious from "@/assets/precious-gordon.jpg";
import catie from "@/assets/catie-pine.jpg";
import julian from "@/assets/julian-jordan.jpg";
import chloe from "@/assets/chloe-edmonds.jpg";
import kim from "@/assets/kim-silvers.jpg";
import donna from "@/assets/donna-bilboe.jpg";
import tezlin from "@/assets/tezlin-harding.jpg";
import jodie from "@/assets/jodie-styche.jpg";
import natasha from "@/assets/natasha-morton.jpg";
import logo from "@/assets/logo.png";

export const logoUrl = logo;

export type Tier = "principal" | "senior" | "assistant" | "associate" | "house";

export interface Person {
  id: string;
  name: string;
  title: string;
  focus: string;
  photo: string;
  parent: string | null;
  tier: Tier;
  x: number;
  y: number;
  house?: string;
  houseColor?: string;
  houseInk?: string;
}

export const WORLD = { w: 2500, h: 1650 };

export const PEOPLE: Person[] = [
  {
    id: "daniel",
    name: "Daniel Opoku",
    title: "Principal",
    focus: "Strategic Overview",
    photo: daniel,
    parent: null,
    tier: "principal",
    x: 1240,
    y: 130,
  },
  {
    id: "charlotte",
    name: "Charlotte D’Oyly",
    title: "DSL",
    focus: "Safeguarding",
    photo: charlotte,
    parent: "daniel",
    tier: "senior",
    x: 1900,
    y: 250,
  },
  {
    id: "kav",
    name: "Kav Pawar",
    title: "Vice Principal",
    focus: "Behaviour & Standards",
    photo: kav,
    parent: "daniel",
    tier: "senior",
    x: 640,
    y: 470,
  },
  {
    id: "richard",
    name: "Richard Johnson",
    title: "Associate Principal",
    focus: "Raising Standards",
    photo: richard,
    parent: "daniel",
    tier: "senior",
    x: 1240,
    y: 470,
  },
  {
    id: "maria",
    name: "Maria Amigot",
    title: "Vice Principal",
    focus: "Quality of Education",
    photo: maria,
    parent: "daniel",
    tier: "senior",
    x: 1840,
    y: 470,
  },
  {
    id: "hannah",
    name: "Hannah Savage",
    title: "Assistant Principal",
    focus: "Attendance",
    photo: hannah,
    parent: "kav",
    tier: "assistant",
    x: 300,
    y: 800,
  },
  {
    id: "trevor",
    name: "Trevor Evans",
    title: "Assistant Principal",
    focus: "Personal Development",
    photo: trevor,
    parent: "kav",
    tier: "assistant",
    x: 720,
    y: 800,
  },
  {
    id: "lucy",
    name: "Lucy Price",
    title: "Assistant Principal",
    focus: "Raising Standards",
    photo: lucy,
    parent: "richard",
    tier: "assistant",
    x: 1180,
    y: 800,
  },
  {
    id: "precious",
    name: "Precious Gordon",
    title: "Assistant Principal",
    focus: "Curriculum",
    photo: precious,
    parent: "maria",
    tier: "assistant",
    x: 1620,
    y: 800,
  },
  {
    id: "catie",
    name: "Catie Pine",
    title: "Assistant Principal",
    focus: "Teaching & Learning",
    photo: catie,
    parent: "maria",
    tier: "assistant",
    x: 2060,
    y: 800,
  },
  {
    id: "julian",
    name: "Julian Jordan",
    title: "Associate Assistant Principal",
    focus: "Behaviour & Culture",
    photo: julian,
    parent: "trevor",
    tier: "associate",
    x: 540,
    y: 1110,
  },
  {
    id: "chloe",
    name: "Chloe Edmonds",
    title: "Associate Assistant Principal",
    focus: "Reading & Character",
    photo: chloe,
    parent: "lucy",
    tier: "associate",
    x: 1180,
    y: 1110,
  },
  {
    id: "kim",
    name: "Kim Silvers",
    title: "SENDCO",
    focus: "SEND",
    photo: kim,
    parent: "catie",
    tier: "associate",
    x: 2060,
    y: 1110,
  },
  {
    id: "donna",
    name: "Donna Bilboe",
    title: "Head of House",
    focus: "Hurricane House",
    photo: donna,
    parent: "hannah",
    tier: "house",
    x: 300,
    y: 1450,
    house: "Hurricane",
    houseColor: "#12b35f",
    houseInk: "#04240f",
  },
  {
    id: "tezlin",
    name: "Tezlin Harding",
    title: "Head of House",
    focus: "Gladiator House",
    photo: tezlin,
    parent: "chloe",
    tier: "house",
    x: 900,
    y: 1450,
    house: "Gladiator",
    houseColor: "#f4cf49",
    houseInk: "#2b2000",
  },
  {
    id: "jodie",
    name: "Jodie Styche",
    title: "Head of House",
    focus: "Lancaster House",
    photo: jodie,
    parent: "precious",
    tier: "house",
    x: 1500,
    y: 1450,
    house: "Lancaster",
    houseColor: "#e8342c",
    houseInk: "#2c0402",
  },
  {
    id: "natasha",
    name: "Natasha Morton",
    title: "Head of House",
    focus: "Spitfire House",
    photo: natasha,
    parent: "catie",
    tier: "house",
    x: 2100,
    y: 1450,
    house: "Spitfire",
    houseColor: "#2f4bf0",
    houseInk: "#02082b",
  },
];

export const BY_ID: Record<string, Person> = Object.fromEntries(
  PEOPLE.map((p) => [p.id, p]),
);

export const CHILDREN: Record<string, string[]> = PEOPLE.reduce(
  (acc, p) => {
    if (p.parent) (acc[p.parent] ||= []).push(p.id);
    return acc;
  },
  {} as Record<string, string[]>,
);

export function ancestorsOf(id: string): string[] {
  const out: string[] = [];
  let cur = BY_ID[id]?.parent;
  while (cur) {
    out.unshift(cur);
    cur = BY_ID[cur]?.parent;
  }
  return out;
}

export function depthOf(id: string): number {
  return ancestorsOf(id).length;
}

/** Chain used by "Explore connection": leadership at the top down through this person to their reports. */
export function journeyFor(id: string): string[] {
  const chain = [...ancestorsOf(id), id];
  const first = (CHILDREN[id] ?? [])[0];
  return first ? [...chain, first] : chain;
}

export const CARD_W = 250;
export const CARD_H = 104;
