import { z } from "zod";

const id = z.string().min(1).max(40);
const minor = z.int().min(0).max(100_000_000_00);

export const MAX_ITEMS = 200;
export const MAX_PEOPLE = 50;

const when = z.iso.datetime();
const hash = z.string().max(64);

export const itemSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  amountMinor: minor.min(1),
  paidBy: id,
  participants: z.array(id).min(1).max(50),
  overrides: z.record(id, minor),
  addedAt: when.optional(),
  deleteHash: hash.optional(),
  joins: z.record(id, z.object({ hash, at: when })).optional(),
});

export const personNameSchema = z.string().trim().min(1).max(30);
export const bankSchema = z.string().trim().max(40).nullable();

export const billDocSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    currency: z.literal("MYR"),
    createdAt: z.iso.datetime(),
    people: z
      .array(
        z.object({
          id,
          name: personNameSchema,
          color: z.int().min(0).max(99),
          bank: bankSchema.optional(),
          accountNo: bankSchema.optional(),
          addedAt: when.optional(),
          keyHash: hash.optional(),
          detailsAt: when.optional(),
        }),
      )
      .min(1)
      .max(MAX_PEOPLE),
    items: z.array(itemSchema).max(MAX_ITEMS),
    ownerId: id.nullable().optional(),
    locked: z.boolean().optional(),
  })
  .refine(
    (doc) => {
      const ids = new Set(doc.people.map((p) => p.id));
      return doc.items.every((i) => ids.has(i.paidBy) && i.participants.every((p) => ids.has(p)));
    },
    { message: "unknown person" },
  );
