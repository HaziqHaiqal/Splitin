import { z } from "zod";

const id = z.string().min(1).max(40);
const minor = z.int().min(0).max(100_000_000_00);

export const billDocSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    currency: z.literal("MYR"),
    createdAt: z.iso.datetime(),
    people: z
      .array(
        z.object({
          id,
          name: z.string().trim().min(1).max(30),
          color: z.int().min(0).max(99),
          bank: z.string().trim().max(40).nullable().optional(),
          accountNo: z.string().trim().max(40).nullable().optional(),
        }),
      )
      .min(1)
      .max(50),
    items: z
      .array(
        z.object({
          id,
          name: z.string().trim().min(1).max(60),
          amountMinor: minor.min(1),
          paidBy: id,
          participants: z.array(id).min(1).max(50),
          overrides: z.record(id, minor),
        }),
      )
      .max(200),
  })
  .refine(
    (doc) => {
      const ids = new Set(doc.people.map((p) => p.id));
      return doc.items.every((i) => ids.has(i.paidBy) && i.participants.every((p) => ids.has(p)));
    },
    { message: "unknown person" },
  );
