export type MenuCategory = "Combos" | "Hambúrgueres" | "Baguetes" | "Tradicionais" | "Fritas" | "Milk-shakes" | "Bebidas" | "Adicionais";

export type MenuItem = {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  priceCents: number;
  tags?: string[];
  station?: "kitchen" | "bar";
};

export const MENU: MenuItem[] = [
  { id: "combo-1", name: "Combo 1", category: "Combos", description: "X-Salada, batata P e refrigerante 250 ml.", priceCents: 3000, tags: ["mais pedido", "boa pedida"], station: "kitchen" },
  { id: "combo-2", name: "Combo 2", category: "Combos", description: "Dois X-Salada, batata G e refrigerante de 1 litro.", priceCents: 5000, tags: ["para dividir"], station: "kitchen" },
  { id: "smash-duplo", name: "Smash Duplo", category: "Hambúrgueres", description: "Pão de batata, dois smash de 60 g, cheddar, bacon, picles, cebola caramelizada e molhos da casa.", priceCents: 2500, tags: ["da casa"], station: "kitchen" },
  { id: "classico", name: "Clássico", category: "Hambúrgueres", description: "Pão de batata, hambúrguer 100 g, cheddar, bacon, ovo, barbecue e molho da casa.", priceCents: 2200, tags: ["clássico"], station: "kitchen" },
  { id: "x-salada", name: "X-Salada", category: "Hambúrgueres", description: "Pão de batata, hambúrguer 100 g, cheddar, tomate, alface, barbecue e molho da casa.", priceCents: 1800, tags: ["mais pedido"], station: "kitchen" },
  { id: "mexicano", name: "Mexicano", category: "Hambúrgueres", description: "Mussarela, geleia de pimenta, chili cremoso e molho da casa.", priceCents: 3200, tags: ["picante"], station: "kitchen" },
  { id: "mr-big", name: "Mr. Big", category: "Hambúrgueres", description: "Duas carnes de 100 g, cheddar, bacon, barbecue e molho da casa.", priceCents: 3300, tags: ["fome grande"], station: "kitchen" },
  { id: "cupinzeiro", name: "Cupinzeiro", category: "Hambúrgueres", description: "Mussarela, cupim desfiado, barbecue e molho da casa.", priceCents: 3500, tags: ["da casa"], station: "kitchen" },
  { id: "di-frango", name: "Di Frango", category: "Hambúrgueres", description: "Frango empanado, catupiry, anéis de cebola, mostarda com mel e molho da casa.", priceCents: 2200, tags: ["frango"], station: "kitchen" },
  { id: "isis", name: "Isis", category: "Hambúrgueres", description: "Cogumelos, tomate, cebola, picles, manjericão, mussarela, gorgonzola e azeite.", priceCents: 3000, tags: ["vegetariano"], station: "kitchen" },
  { id: "sertanejo", name: "Sertanejo", category: "Baguetes", description: "Carne de sol, requeijão, tomate, cebola roxa e queijo coalho com mel.", priceCents: 2200, tags: ["regional"], station: "kitchen" },
  { id: "pernil-suino", name: "Pernil Suíno", category: "Baguetes", description: "Pernil ao barbecue, mussarela, tomate, rúcula e molho da casa.", priceCents: 2500, station: "kitchen" },
  { id: "dog-na-chapa", name: "Dog na Chapa", category: "Baguetes", description: "Linguiça defumada, mussarela, bacon, tomate, cebola roxa e molhos.", priceCents: 2200, tags: ["na chapa"], station: "kitchen" },
  { id: "bauru-especial", name: "Bauru Especial", category: "Tradicionais", description: "Hambúrguer, ovo, bacon, salsicha, presunto, mussarela, tomate e alface.", priceCents: 1800, station: "kitchen" },
  { id: "x-frango", name: "X-Frango", category: "Tradicionais", description: "Hambúrguer, frango desfiado com requeijão, ovo, presunto e mussarela.", priceCents: 1800, station: "kitchen" },
  { id: "bauru", name: "Bauru", category: "Tradicionais", description: "Hambúrguer, ovo, presunto, mussarela, tomate e alface.", priceCents: 1000, station: "kitchen" },
  { id: "torrada", name: "Torrada", category: "Tradicionais", description: "Pão de forma e queijo mussarela.", priceCents: 600, station: "kitchen" },
  { id: "misto-quente", name: "Misto Quente", category: "Tradicionais", description: "Pão de forma, queijo e presunto.", priceCents: 800, station: "kitchen" },
  { id: "batata-p", name: "Batata P", category: "Fritas", description: "Porção de 150 g.", priceCents: 1600, station: "kitchen" },
  { id: "batata-g", name: "Batata G", category: "Fritas", description: "Porção de 250 g.", priceCents: 1900, station: "kitchen" },
  { id: "batata-cheddar-bacon", name: "Batata com Cheddar e Bacon", category: "Fritas", description: "Porção de 250 g, cheddar cremoso e bacon.", priceCents: 2400, tags: ["para dividir"], station: "kitchen" },
  { id: "aneis-cebola", name: "Anéis de Cebola", category: "Fritas", description: "Porção crocante de 150 g.", priceCents: 1500, station: "kitchen" },
  { id: "shake-ovomaltine", name: "Shake Ovomaltine", category: "Milk-shakes", description: "400 ml, tamanho único.", priceCents: 2000, station: "bar" },
  { id: "shake-morango", name: "Shake Morango", category: "Milk-shakes", description: "400 ml, tamanho único.", priceCents: 2000, station: "bar" },
  { id: "shake-coffee", name: "Shake Coffee", category: "Milk-shakes", description: "400 ml com café.", priceCents: 2000, station: "bar" },
  { id: "suco", name: "Suco", category: "Bebidas", description: "400 ml, tamanho único.", priceCents: 750, station: "bar" },
  { id: "cha-gelado", name: "Chá Gelado", category: "Bebidas", description: "Mate com limão ou capim-santo com limão.", priceCents: 1000, station: "bar" },
  { id: "refri-lata", name: "Refrigerante Lata", category: "Bebidas", description: "Coca-Cola ou Guaraná.", priceCents: 600, station: "bar" },
  { id: "agua", name: "Água Mineral", category: "Bebidas", description: "Com ou sem gás.", priceCents: 300, station: "bar" },
  { id: "bacon", name: "Bacon", category: "Adicionais", description: "Porção extra de bacon.", priceCents: 400, station: "kitchen" },
  { id: "cheddar-extra", name: "Cheddar Extra", category: "Adicionais", description: "Mais cheddar para a mordida.", priceCents: 300, station: "kitchen" },
  { id: "ovo", name: "Ovo", category: "Adicionais", description: "Ovo preparado na chapa.", priceCents: 300, station: "kitchen" },
  { id: "molho-casa", name: "Molho da Casa", category: "Adicionais", description: "Porção extra do molho da casa.", priceCents: 200, station: "kitchen" },
];

export const MENU_CATEGORIES: MenuCategory[] = ["Combos", "Hambúrgueres", "Baguetes", "Tradicionais", "Fritas", "Milk-shakes", "Bebidas", "Adicionais"];
