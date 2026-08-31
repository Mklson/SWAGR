import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const leverandor = await prisma.leverandor.create({
    data: { navn: "Nordic Reklame AS" },
  });

  const tskjorte = await prisma.vare.create({
    data: { navn: "T-skjorte", kategori: "Tekstil", leverandorId: leverandor.id },
  });
  const vinglass = await prisma.vare.create({
    data: { navn: "Vinglass", kategori: "Servise", leverandorId: leverandor.id },
  });

  const tskjorteSort = await prisma.variant.create({
    data: {
      vareId: tskjorte.id,
      sku: "TSK-SORT-M",
      attributter: { farge: "sort", storrelse: "M" },
    },
  });
  const tskjorteHvit = await prisma.variant.create({
    data: {
      vareId: tskjorte.id,
      sku: "TSK-HVIT-L",
      attributter: { farge: "hvit", storrelse: "L" },
    },
  });
  const vinglass25cl = await prisma.variant.create({
    data: {
      vareId: vinglass.id,
      sku: "VIN-25CL",
      attributter: { volum: "25cl" },
    },
  });

  const lager = await prisma.lokasjon.create({
    data: { navn: "Hovedlager", type: "lager" },
  });
  const utstillingslokale = await prisma.lokasjon.create({
    data: { navn: "Utstillingslokale", type: "butikk" },
  });

  const kundeKontekst = await prisma.kontekst.create({
    data: { type: "kunde", navn: "Acme Events", referanse: "KUNDE-1001" },
  });
  const internbrukKontekst = await prisma.kontekst.create({
    data: { type: "internbruk", navn: "Intern markedsføring" },
  });
  const innkjopKontekst = await prisma.kontekst.create({
    data: { type: "innkjop", navn: leverandor.navn, referanse: leverandor.id },
  });

  await prisma.formaal.createMany({
    data: [{ navn: "Festival" }, { navn: "Messe" }, { navn: "Gave" }],
  });

  const bruker = await prisma.bruker.create({
    data: { navn: "Kari Nordmann", rolle: "lagermedarbeider" },
  });

  await prisma.bevegelse.createMany({
    data: [
      {
        variantId: tskjorteSort.id,
        lokasjonId: lager.id,
        kontekstId: innkjopKontekst.id,
        brukerId: bruker.id,
        type: "inn",
        antall: 100,
      },
      {
        variantId: tskjorteHvit.id,
        lokasjonId: lager.id,
        kontekstId: innkjopKontekst.id,
        brukerId: bruker.id,
        type: "inn",
        antall: 60,
      },
      {
        variantId: vinglass25cl.id,
        lokasjonId: lager.id,
        kontekstId: innkjopKontekst.id,
        brukerId: bruker.id,
        type: "inn",
        antall: 200,
      },
      {
        variantId: tskjorteSort.id,
        lokasjonId: lager.id,
        kontekstId: kundeKontekst.id,
        brukerId: bruker.id,
        type: "ut",
        antall: 25,
      },
      {
        variantId: vinglass25cl.id,
        lokasjonId: utstillingslokale.id,
        kontekstId: innkjopKontekst.id,
        brukerId: bruker.id,
        type: "inn",
        antall: 20,
      },
      {
        variantId: vinglass25cl.id,
        lokasjonId: lager.id,
        kontekstId: internbrukKontekst.id,
        brukerId: bruker.id,
        type: "ut",
        antall: 10,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
