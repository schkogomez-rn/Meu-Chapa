export type MenuCategory =
  | "Combos"
  | "Hambúrgueres"
  | "Baguetes"
  | "Tradicionais"
  | "Fritas"
  | "Milk-shakes"
  | "Bebidas"
  | "Adicionais";

export type MenuItem = {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  priceCents: number;
  tags?: string[];
  station?: "kitchen" | "bar";
  /** true = item is a customizable addon from the addons matrix */
  isAddon?: boolean;
};

// ─── Full Menu ────────────────────────────────────────────────────────────────

export const MENU: MenuItem[] = [
  // ── Combos ────────────────────────────────────────────────────────────────
  {
    id: "combo-1",
    name: "Combo 1",
    category: "Combos",
    description: "01 X-Salada (hambúrguer artesanal 100g) + 01 Batata P (150g) + 01 Coquinha garrafinha (250ml).",
    priceCents: 3000,
    tags: ["mais pedido", "boa pedida"],
    station: "kitchen",
  },
  {
    id: "combo-2",
    name: "Combo 2",
    category: "Combos",
    description: "02 X-Salada (hambúrguer artesanal 100g) + 01 Batata G (250g) + 01 Refrigerante 1L (Pepsi ou Guaraná).",
    priceCents: 5000,
    tags: ["para dividir"],
    station: "kitchen",
  },

  // ── Hambúrgueres Caseiros (Artesanais) ────────────────────────────────────
  {
    id: "x-salada",
    name: "X-Salada",
    category: "Hambúrgueres",
    description: "Pão de batata, hambúrguer 100g, cheddar, tomate, alface, molho barbecue e molho da casa.",
    priceCents: 1800,
    tags: ["mais pedido"],
    station: "kitchen",
  },
  {
    id: "classico",
    name: "Clássico",
    category: "Hambúrgueres",
    description: "Pão de batata, hambúrguer 100g, cheddar, bacon, ovo, molho barbecue e molho da casa.",
    priceCents: 2200,
    tags: ["clássico"],
    station: "kitchen",
  },
  {
    id: "di-frango",
    name: "Di Frango",
    category: "Hambúrgueres",
    description: "Pão de batata, filés de frango empanado, catupiry (original), anéis de cebola, mostarda com mel e molho da casa.",
    priceCents: 2200,
    tags: ["frango"],
    station: "kitchen",
  },
  {
    id: "smash-duplo",
    name: "Smash Duplo",
    category: "Hambúrgueres",
    description: "Pão de batata, dois smash burgers 60g, duas fatias de cheddar, bacon, picles, cebola caramelizada, molho barbecue e molho da casa.",
    priceCents: 2500,
    tags: ["da casa"],
    station: "kitchen",
  },
  {
    id: "isis",
    name: "Isis (Vegetariano)",
    category: "Hambúrgueres",
    description: "Pão de batata, cogumelos shitake na manteiga com tomate, cebola, picles, shoyu e manjericão, mussarela derretida com gorgonzola e finalizado com azeite.",
    priceCents: 3000,
    tags: ["vegetariano"],
    station: "kitchen",
  },
  {
    id: "mexicano",
    name: "Mexicano",
    category: "Hambúrgueres",
    description: "Pão de batata, hambúrguer 100g, mussarela, geleia de pimenta, chili (carne moída cremosa e bem temperada) e molho da casa.",
    priceCents: 3200,
    tags: ["picante"],
    station: "kitchen",
  },
  {
    id: "mr-big",
    name: "Mr. Big",
    category: "Hambúrgueres",
    description: "Pão de batata, duas carnes de 100g, cheddar, bacon, barbecue e molho da casa.",
    priceCents: 3300,
    tags: ["fome grande"],
    station: "kitchen",
  },
  {
    id: "cupinzeiro",
    name: "Cupinzeiro",
    category: "Hambúrgueres",
    description: "Pão de batata com mussarela, carne de cupim desfiado, molho barbecue e molho da casa.",
    priceCents: 3500,
    tags: ["da casa"],
    station: "kitchen",
  },

  // ── Sanduíches no Pão Baguete ─────────────────────────────────────────────
  {
    id: "dog-na-chapa",
    name: "Dog na Chapa",
    category: "Baguetes",
    description: "Pão baguete, linguiça defumada, mussarela, bacon, tomate, cebola roxa, molho barbecue e molho da casa.",
    priceCents: 2200,
    tags: ["na chapa"],
    station: "kitchen",
  },
  {
    id: "sertanejo",
    name: "Sertanejo",
    category: "Baguetes",
    description: "Pão baguete, carne de sol com requeijão, tomate e cebola roxa, queijo coalho com mel, molho barbecue e molho da casa.",
    priceCents: 2200,
    tags: ["regional"],
    station: "kitchen",
  },
  {
    id: "pernil-suino",
    name: "Pernil Suíno",
    category: "Baguetes",
    description: "Pão baguete, pernil ao molho barbecue, mussarela, tomate, rúcula e molho da casa.",
    priceCents: 2500,
    station: "kitchen",
  },

  // ── Sanduíches Tradicionais ───────────────────────────────────────────────
  {
    id: "torrada",
    name: "Torrada",
    category: "Tradicionais",
    description: "Pão de forma e queijo mussarela.",
    priceCents: 600,
    station: "kitchen",
  },
  {
    id: "misto-quente",
    name: "Misto Quente",
    category: "Tradicionais",
    description: "Pão de forma, queijo e presunto.",
    priceCents: 800,
    station: "kitchen",
  },
  {
    id: "bauru",
    name: "Bauru",
    category: "Tradicionais",
    description: "Pão, hambúrguer, ovo, presunto, mussarela, tomate, alface e molho da casa.",
    priceCents: 1000,
    station: "kitchen",
  },
  {
    id: "bauru-especial",
    name: "Bauru Especial",
    category: "Tradicionais",
    description: "Pão, hambúrguer, ovo, bacon, salsicha, presunto, mussarela, tomate, alface e molho da casa.",
    priceCents: 1800,
    station: "kitchen",
  },
  {
    id: "x-frango",
    name: "X-Frango",
    category: "Tradicionais",
    description: "Pão, hambúrguer, frango desfiado com requeijão, ovo, presunto, mussarela e molho da casa.",
    priceCents: 1800,
    station: "kitchen",
  },

  // ── Fritas & Porções ──────────────────────────────────────────────────────
  {
    id: "batata-p",
    name: "Batata Frita (P)",
    category: "Fritas",
    description: "Porção de 150g.",
    priceCents: 1600,
    station: "kitchen",
  },
  {
    id: "batata-g",
    name: "Batata Frita (G)",
    category: "Fritas",
    description: "Porção de 250g.",
    priceCents: 1900,
    station: "kitchen",
  },
  {
    id: "aneis-cebola",
    name: "Anéis de Cebola",
    category: "Fritas",
    description: "Porção crocante de 150g.",
    priceCents: 1500,
    station: "kitchen",
  },
  {
    id: "batata-cheddar-bacon",
    name: "Batata com Cheddar e Bacon",
    category: "Fritas",
    description: "Porção de 250g, cheddar cremoso e bacon.",
    priceCents: 2400,
    tags: ["para dividir"],
    station: "kitchen",
  },
  {
    id: "batata-cheddar-calabresa",
    name: "Batata com Cheddar e Calabresa",
    category: "Fritas",
    description: "Porção de 250g, cheddar cremoso e calabresa.",
    priceCents: 2400,
    tags: ["para dividir"],
    station: "kitchen",
  },

  // ── Milk-shakes (400ml) ───────────────────────────────────────────────────
  {
    id: "shake-ovomaltine",
    name: "Shake Ovomaltine",
    category: "Milk-shakes",
    description: "400ml, tamanho único.",
    priceCents: 2000,
    station: "bar",
  },
  {
    id: "shake-morango",
    name: "Shake Morango",
    category: "Milk-shakes",
    description: "400ml, tamanho único.",
    priceCents: 2000,
    station: "bar",
  },
  {
    id: "shake-coffee",
    name: "Shake Coffee",
    category: "Milk-shakes",
    description: "400ml com café.",
    priceCents: 2000,
    station: "bar",
  },
  {
    id: "jack-coffee",
    name: "Jack Coffee",
    category: "Milk-shakes",
    description: "400ml com Whisky Jack Daniel's e café.",
    priceCents: 2500,
    tags: ["adulto"],
    station: "bar",
  },

  // ── Bebidas ───────────────────────────────────────────────────────────────
  {
    id: "suco-tradicional",
    name: "Suco Tradicional",
    category: "Bebidas",
    description: "400ml, tamanho único.",
    priceCents: 750,
    station: "bar",
  },
  {
    id: "vitamina",
    name: "Vitamina",
    category: "Bebidas",
    description: "400ml, tamanho único.",
    priceCents: 850,
    station: "bar",
  },
  {
    id: "suco-especial",
    name: "Suco Especial",
    category: "Bebidas",
    description: "400ml. Abacaxi com Capim Santo ou Abacaxi com Hortelã.",
    priceCents: 1000,
    tags: ["especial"],
    station: "bar",
  },
  {
    id: "cha-gelado",
    name: "Chá Gelado",
    category: "Bebidas",
    description: "Mate Limão ou Capim Santo com Limão.",
    priceCents: 1000,
    station: "bar",
  },
  {
    id: "agua",
    name: "Água Mineral",
    category: "Bebidas",
    description: "Sem gás.",
    priceCents: 200,
    station: "bar",
  },
  {
    id: "agua-gas",
    name: "Água Mineral com Gás",
    category: "Bebidas",
    description: "Com gás.",
    priceCents: 300,
    station: "bar",
  },
  {
    id: "coquinha",
    name: "Coquinha",
    category: "Bebidas",
    description: "Garrafinha 250ml.",
    priceCents: 400,
    station: "bar",
  },
  {
    id: "refri-lata",
    name: "Refrigerante Lata",
    category: "Bebidas",
    description: "Coca-Cola ou Guaraná.",
    priceCents: 600,
    station: "bar",
  },
  {
    id: "h2oh",
    name: "H2OH! Limoneto",
    category: "Bebidas",
    description: "H2OH! Limoneto.",
    priceCents: 700,
    station: "bar",
  },
  {
    id: "refri-1l-pepsi-guarana",
    name: "Refrigerante 1 Litro",
    category: "Bebidas",
    description: "Pepsi ou Guaraná, 1 litro.",
    priceCents: 800,
    station: "bar",
  },
  {
    id: "refri-1l-coca",
    name: "Refrigerante 1 Litro Coca-Cola",
    category: "Bebidas",
    description: "Coca-Cola, 1 litro.",
    priceCents: 1000,
    tags: ["mais pedido"],
    station: "bar",
  },

  // ── Adicionais (Matriz de Customização) ───────────────────────────────────
  { id: "ad-picles",          name: "Picles",                     category: "Adicionais", description: "Picles fatiado.",                         priceCents:  150, isAddon: true, station: "kitchen" },
  { id: "ad-molho-extra",     name: "Molho Extra",                category: "Adicionais", description: "Porção extra de molho.",                   priceCents:  200, isAddon: true, station: "kitchen" },
  { id: "ad-presunto",        name: "Presunto",                   category: "Adicionais", description: "Fatias de presunto.",                      priceCents:  200, isAddon: true, station: "kitchen" },
  { id: "ad-chantilly",       name: "Chantilly",                  category: "Adicionais", description: "Chantilly.",                               priceCents:  200, isAddon: true, station: "kitchen" },
  { id: "ad-mussarela",       name: "Mussarela",                  category: "Adicionais", description: "Fatia de mussarela derretida.",             priceCents:  250, isAddon: true, station: "kitchen" },
  { id: "ad-ovo",             name: "Ovo",                        category: "Adicionais", description: "Ovo preparado na chapa.",                   priceCents:  300, isAddon: true, station: "kitchen" },
  { id: "ad-salada",          name: "Salada",                     category: "Adicionais", description: "Alface e tomate.",                          priceCents:  300, isAddon: true, station: "kitchen" },
  { id: "ad-salsicha",        name: "Salsicha",                   category: "Adicionais", description: "Salsicha grelhada.",                        priceCents:  300, isAddon: true, station: "kitchen" },
  { id: "ad-cheddar-fatia",   name: "Cheddar Fatia",              category: "Adicionais", description: "Fatia de cheddar.",                         priceCents:  300, isAddon: true, station: "kitchen" },
  { id: "ad-queijo-coalho",   name: "Queijo Coalho",              category: "Adicionais", description: "Queijo coalho grelhado.",                   priceCents:  300, isAddon: true, station: "kitchen" },
  { id: "ad-ovomaltine",      name: "Ovomaltine",                 category: "Adicionais", description: "Adicional de ovomaltine.",                  priceCents:  300, isAddon: true, station: "bar"     },
  { id: "ad-bacon-fatiado",   name: "Bacon Fatiado",              category: "Adicionais", description: "Bacon fatiado crocante.",                   priceCents:  400, isAddon: true, station: "kitchen" },
  { id: "ad-cebola-caramel",  name: "Cebola Caramelizada",        category: "Adicionais", description: "Cebola caramelizada no açúcar.",             priceCents:  400, isAddon: true, station: "kitchen" },
  { id: "ad-bacon-cubos",     name: "Bacon em Cubos",             category: "Adicionais", description: "Bacon em cubos tostados.",                  priceCents:  500, isAddon: true, station: "kitchen" },
  { id: "ad-hamburguer-ind",  name: "Hambúrguer Industrial",      category: "Adicionais", description: "Hambúrguer industrial extra.",              priceCents:  600, isAddon: true, station: "kitchen" },
  { id: "ad-queijo-derretido",name: "Queijo Derretido",           category: "Adicionais", description: "Blend de queijos derretidos.",               priceCents:  600, isAddon: true, station: "kitchen" },
  { id: "ad-aneis-cebola",    name: "Anéis de Cebola",            category: "Adicionais", description: "Anéis de cebola empanados.",                 priceCents:  600, isAddon: true, station: "kitchen" },
  { id: "ad-frango-desf",     name: "Frango Desfiado",            category: "Adicionais", description: "Frango desfiado temperado.",                 priceCents:  700, isAddon: true, station: "kitchen" },
  { id: "ad-linguica-fina",   name: "Linguiça Fina",              category: "Adicionais", description: "Linguiça fina grelhada.",                    priceCents:  700, isAddon: true, station: "kitchen" },
  { id: "ad-linguica-calabs", name: "Linguiça Calabresa",         category: "Adicionais", description: "Linguiça calabresa.",                        priceCents:  700, isAddon: true, station: "kitchen" },
  { id: "ad-creme-cheddar",   name: "Creme Cheddar",              category: "Adicionais", description: "Creme de cheddar derretido.",                priceCents:  700, isAddon: true, station: "kitchen" },
  { id: "ad-hamburguer-60g",  name: "Hambúrguer 60g",             category: "Adicionais", description: "Hambúrguer artesanal 60g extra.",            priceCents: 1000, isAddon: true, station: "kitchen" },
  { id: "ad-hamburguer-100g", name: "Hambúrguer 100g",            category: "Adicionais", description: "Hambúrguer artesanal 100g extra.",           priceCents: 1200, isAddon: true, station: "kitchen" },
  { id: "ad-frango-emp",      name: "Frango Empanado 100g",       category: "Adicionais", description: "Filé de frango empanado 100g.",              priceCents: 1200, isAddon: true, station: "kitchen" },
  { id: "ad-carne-sol",       name: "Carne de Sol",               category: "Adicionais", description: "Carne de sol desfiada.",                     priceCents: 1200, isAddon: true, station: "kitchen" },
  { id: "ad-chili",           name: "Chili",                      category: "Adicionais", description: "Carne moída cremosa e bem temperada.",        priceCents: 1500, isAddon: true, station: "kitchen" },
  { id: "ad-cupim",           name: "Cupim",                      category: "Adicionais", description: "Carne de cupim desfiada.",                    priceCents: 1800, isAddon: true, station: "kitchen" },
];

export const MENU_CATEGORIES: MenuCategory[] = [
  "Combos",
  "Hambúrgueres",
  "Baguetes",
  "Tradicionais",
  "Fritas",
  "Milk-shakes",
  "Bebidas",
  "Adicionais",
];

// ─── Business Rules ──────────────────────────────────────────────────────────

/** Payment methods that trigger the credit card surcharge */
export const CREDIT_CARD_METHODS = ["Cartão Crédito", "credito"];

/** Credit card surcharge rate (5%) */
export const CREDIT_CARD_SURCHARGE_RATE = 0.05;

/** Accepted card brands */
export const ACCEPTED_CARD_BRANDS = ["Visa", "Mastercard", "Elo", "Hipercard"] as const;
export type CardBrand = (typeof ACCEPTED_CARD_BRANDS)[number];

/**
 * Calculates the final total considering credit card surcharge.
 * @param subtotalCents Subtotal in cents
 * @param paymentMethod The chosen payment method string
 * @returns Object with subtotal, surcharge and total in cents
 */
export function calcTotal(subtotalCents: number, paymentMethod: string) {
  const isCreditCard = CREDIT_CARD_METHODS.some(
    (m) => paymentMethod.toLowerCase().includes(m.toLowerCase())
  );
  const surchargeCents = isCreditCard
    ? Math.round(subtotalCents * CREDIT_CARD_SURCHARGE_RATE)
    : 0;
  return {
    subtotalCents,
    surchargeCents,
    totalCents: subtotalCents + surchargeCents,
    isCreditCard,
  };
}

/** Returns only the addon items from the menu */
export const ADDONS = MENU.filter((item) => item.isAddon);

/** Returns only the main menu items (non-addon) */
export const MAIN_MENU = MENU.filter((item) => !item.isAddon);
