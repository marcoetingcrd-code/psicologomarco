/**
 * Knowledge Graph — tipi base.
 *
 * Atlas a polipo: ogni messaggio dell'utente attiva un extractor che identifica
 * entità (persone/eventi/atteggiamenti/traumi/pattern), le incasella in macro-categorie
 * e crea relazioni causali tra loro. Il grafo cresce nel tempo e diventa lo
 * specchio che permette ad Atlas di riconoscere "cosa boicotta cosa".
 */

export type EntityKind =
  | "person"     // Marta, padre, capo, amico
  | "event"      // "rottura con Marta", "licenziamento 2023"
  | "attitude"   // "nervosismo da lavoro", "evitamento conflitto"
  | "pattern"    // "perdo relazioni quando stresso il lavoro"
  | "trauma"     // "padre punitivo", "abbandono madre"
  | "goal"       // "lanciare prodotto", "chiudere palestra"
  | "failure"    // "lancio mancato 2024", "tentativo X fallito"
  | "place"      // "casa madre", "palestra"
  | "resource"   // "amico stronzo che dice la verità"
  | "belief";    // "nessuno mi vuole davvero", "i soldi sono sporchi"

export type Category =
  | "relationships"  // partner attuali/passati, dating, relazioni romantiche
  | "family"         // famiglia origine, figli, parenti
  | "work"           // lavoro, business, carriera, soldi-da-lavoro
  | "money"          // soldi, gestione, ricchezza, povertà
  | "body"           // fisico, salute, sport, sostanze
  | "trauma"         // ferite passate non risolte
  | "identity"       // chi sei, chi vuoi diventare, valori
  | "fear"           // paure ricorrenti
  | "power"          // controllo, autorità, agency
  | "addiction"      // dipendenze (sostanze, comportamenti, persone)
  | "sex"            // sesso, intimità, dinamiche sessuali
  | "social"         // amici, gruppo, ambiente
  | "spiritual"      // senso, scopo, valori profondi
  | "generic";

export type RelationKind =
  | "causes"      // X causa Y
  | "blocks"      // X blocca Y
  | "repeats"     // X si ripete con Y (pattern)
  | "links_to"    // associazione semplice
  | "boycotts"    // X sabota una categoria/obiettivo
  | "triggers"    // X attiva Y emotivamente
  | "heals"       // X allevia Y
  | "resembles"   // X è simile a Y (specchio, transfer)
  | "part_of"     // X è parte di Y
  | "involves";   // evento X coinvolge persona Y

export type PatternKind = "repetition" | "boycott" | "conflict" | "reinforcement";

export interface Entity {
  id: string;
  kind: EntityKind;
  category: Category;
  label: string;                 // "Marta", "padre", "nervosismo da lavoro"
  aliases: string[];             // forme alternative ["lei", "ex", "marti"]
  attributes: {
    role?: string;               // "ex partner", "padre", "capo"
    traits?: string[];           // ["punitivo", "intermittente", "carismatico"]
    intensity?: number;          // 0..1 quanta carica emotiva ha
    salience?: number;           // 0..1 quanto centrale è nel grafo
    timeframe?: string;          // "infanzia", "2018-2023", "ultimo mese"
    notes?: string;
    [k: string]: unknown;
  };
  firstSeenAt: number;
  lastMentionedAt: number;
  mentionCount: number;
  importance: number;            // 0..100
}

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  kind: RelationKind;
  detail?: string;               // "ti ha lasciato perché eri stressato"
  weight: number;                // 0..100
  firstSeenAt: number;
  lastSeenAt: number;
  evidenceCount: number;
}

export interface Pattern {
  id: string;
  signature: string;
  kind: PatternKind;
  title: string;
  summary: string;
  category: Category;
  involvedEntityIds: string[];
  strength: number;              // 0..100
  firstDetectedAt: number;
  lastReinforcedAt: number;
  evidenceCount: number;
}

export const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  person: "persona",
  event: "evento",
  attitude: "atteggiamento",
  pattern: "pattern",
  trauma: "trauma",
  goal: "obiettivo",
  failure: "fallimento",
  place: "luogo",
  resource: "risorsa",
  belief: "credenza",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  relationships: "Relazioni",
  family: "Famiglia",
  work: "Lavoro",
  money: "Soldi",
  body: "Corpo",
  trauma: "Trauma",
  identity: "Identità",
  fear: "Paura",
  power: "Potere/Controllo",
  addiction: "Dipendenze",
  sex: "Sesso/Intimità",
  social: "Amici/Sociale",
  spiritual: "Senso/Spirito",
  generic: "Generico",
};

export const RELATION_LABELS: Record<RelationKind, string> = {
  causes: "causa",
  blocks: "blocca",
  repeats: "si ripete con",
  links_to: "legato a",
  boycotts: "boicotta",
  triggers: "attiva",
  heals: "allevia",
  resembles: "somiglia a",
  part_of: "parte di",
  involves: "coinvolge",
};
