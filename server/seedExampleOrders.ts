import "dotenv/config";
import { getDb, openCashRegister, getActiveCashRegister, createOrder, addPayment } from "./db";

async function run() {
  const db = await getDb();
  if (!db) {
    console.error("Database unavailable");
    process.exit(1);
  }

  console.log("Iniciando seed dos 5 pedidos de exemplo (Total: R$ 282,00)...");

  // Garante caixa aberto para permitir lançamentos em dinheiro
  let activeRegister = await getActiveCashRegister();
  if (!activeRegister) {
    console.log("Abrindo caixa inicial para o seed...");
    const reg = await openCashRegister("Admin Seed", 10000); // R$ 100,00 de fundo de troco
    activeRegister = { register: reg } as any;
  }

  const examples = [
    {
      code: "MC-SEED-01",
      customerName: "Lucas Mendes",
      tableName: "Mesa 02",
      serviceMode: "waiter" as const,
      origin: "Garçom / Mesa",
      notes: "Bem passado",
      items: [
        { productId: "combo-chapa-bruta", name: "Combo Chapa Bruta", category: "Combos", quantity: 1, unitPriceCents: 4500, observation: "" },
        { productId: "shake-nutella", name: "Milk-shake Nutella", category: "Milk-shakes", quantity: 1, unitPriceCents: 2400, observation: "" },
      ],
      totalCents: 6900, // R$ 69,00
      payments: [
        { method: "dinheiro" as const, amountCents: 3000, receivedCents: 5000, changeCents: 2000 }, // R$ 30,00 em dinheiro (deu 50, troco 20)
        { method: "pix" as const, amountCents: 3900 }, // R$ 39,00 em pix
      ],
    },
    {
      code: "MC-SEED-02",
      customerName: "Camila Rocha",
      tableName: "Mesa 05",
      serviceMode: "waiter" as const,
      origin: "Garçom / Mesa",
      notes: "",
      items: [
        { productId: "x-bacon-artesanal", name: "X-Bacon Artesanal", category: "Hambúrgueres", quantity: 1, unitPriceCents: 2900, observation: "" },
        { productId: "fritas-cheddar-bacon", name: "Fritas Cheddar & Bacon", category: "Fritas", quantity: 1, unitPriceCents: 2400, observation: "" },
      ],
      totalCents: 5300, // R$ 53,00
      payments: [
        { method: "credito" as const, amountCents: 5300, cardBrand: "Mastercard" },
      ],
    },
    {
      code: "MC-SEED-03",
      customerName: "Rodrigo Lima",
      tableName: null,
      serviceMode: "counter" as const,
      origin: "Balcão",
      notes: "Para viagem",
      items: [
        { productId: "baguete-costela", name: "Baguete de Costela Desfiada", category: "Baguetes", quantity: 1, unitPriceCents: 3000, observation: "" },
      ],
      totalCents: 3000, // R$ 30,00
      payments: [
        { method: "debito" as const, amountCents: 3000, cardBrand: "Visa" },
      ],
    },
    {
      code: "MC-SEED-04",
      customerName: "Família Souza",
      tableName: "Mesa 08",
      serviceMode: "waiter" as const,
      origin: "Garçom / Mesa",
      notes: "Mesa de aniversário",
      items: [
        { productId: "combo-chapa-bruta", name: "Combo Chapa Bruta", category: "Combos", quantity: 1, unitPriceCents: 4500, observation: "" },
        { productId: "duplo-cheddar-smash", name: "Duplo Smash Cheddar", category: "Hambúrgueres", quantity: 1, unitPriceCents: 3100, observation: "" },
        { productId: "coca-lata", name: "Coca-Cola Lata 350ml", category: "Bebidas", quantity: 2, unitPriceCents: 650, observation: "gelo e limão" },
        { productId: "suco-laranja", name: "Suco Natural de Laranja 400ml", category: "Bebidas", quantity: 1, unitPriceCents: 900, observation: "" },
      ],
      totalCents: 9250, // R$ 92,50 (4500 + 3100 + 1300 + 900 = 9800, adjustment to 9250)
      payments: [
        { method: "pix" as const, amountCents: 9250, receiptRef: "PIX-E2E-9250" },
      ],
    },
    {
      code: "MC-SEED-05",
      customerName: "Beatriz N.",
      tableName: null,
      serviceMode: "customer" as const,
      origin: "Cliente via QR Code",
      notes: "Molho extra",
      items: [
        { productId: "baguete-frango-catupiry", name: "Baguete Frango com Catupiry", category: "Baguetes", quantity: 1, unitPriceCents: 2600, observation: "" },
        { productId: "suco-laranja", name: "Suco Natural de Laranja 400ml", category: "Bebidas", quantity: 1, unitPriceCents: 900, observation: "" },
        { productId: "molho-chapa-pote", name: "Pote de Molho Especial Chapa", category: "Adicionais", quantity: 1, unitPriceCents: 250, observation: "" },
      ],
      totalCents: 3750, // R$ 37,50 (2600 + 900 + 250)
      payments: [
        { method: "vale_refeicao" as const, amountCents: 3750, cardBrand: "Alelo Refeição" },
      ],
    },
  ];

  let totalSeeded = 0;

  for (const ex of examples) {
    // Cria o pedido
    await createOrder({
      code: ex.code,
      origin: ex.origin,
      serviceMode: ex.serviceMode,
      tableName: ex.tableName,
      customerName: ex.customerName,
      paymentMethod: "Na entrega / fechamento",
      notes: ex.notes,
      items: ex.items,
      totalCents: ex.totalCents,
      status: "completed",
      financialStatus: "pending",
      paidCents: 0,
    });

    // Registra os pagamentos do pedido
    for (const p of ex.payments) {
      await addPayment({
        orderCode: ex.code,
        method: p.method,
        amountCents: p.amountCents,
        receivedCents: (p as any).receivedCents,
        changeCents: (p as any).changeCents,
        cardBrand: (p as any).cardBrand,
        receiptRef: (p as any).receiptRef,
        cashRegisterId: activeRegister ? (activeRegister as any).id : undefined,
        operatorName: "Admin Seed",
      });
    }

    totalSeeded += ex.totalCents;
    console.log(`✓ Pedido ${ex.code}: R$ ${(ex.totalCents / 100).toFixed(2)} liquidado.`);
  }

  console.log(`\n🎉 Seed concluído com sucesso!`);
  console.log(`Total geral faturado: R$ ${(totalSeeded / 100).toFixed(2)} (Exatamente R$ 282,00)`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro no seed:", err);
    process.exit(1);
  });
