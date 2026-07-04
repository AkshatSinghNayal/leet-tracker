// Backfill: for every Question with solved=true, upsert into SolvedQuestion(ownerId, leetcodeId)
// so the new global solved-state feature works for pre-existing data.
import { db } from "../src/lib/db";

async function main() {
  const solved = await db.question.findMany({
    where: { solved: true },
    select: { ownerId: true, leetcodeId: true, solvedAt: true },
  });
  console.log(`Found ${solved.length} solved questions to backfill`);

  let inserted = 0;
  for (const q of solved) {
    await db.solvedQuestion.upsert({
      where: { ownerId_leetcodeId: { ownerId: q.ownerId, leetcodeId: q.leetcodeId } },
      update: {},
      create: {
        ownerId: q.ownerId,
        leetcodeId: q.leetcodeId,
        solvedAt: q.solvedAt ?? new Date(),
      },
    });
    inserted++;
  }
  console.log(`Backfilled ${inserted} SolvedQuestion rows`);

  // Also backfill primaryTopic for any rows that ended up empty
  const noTopic = await db.question.updateMany({
    where: { primaryTopic: "" },
    data: { primaryTopic: "Uncategorized" },
  });
  console.log(`Updated ${noTopic.count} rows with default primaryTopic`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
