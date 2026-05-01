import { PrismaClient } from '@prisma/client';
import { runLegacyMemberMigration } from './legacy-member-migration-lib.mjs';

const prisma = new PrismaClient();

function write(message) {
  process.stdout.write(`${message}\n`);
}

runLegacyMemberMigration({ prisma })
  .then(({ report, reportPath }) => {
    write(
      JSON.stringify(
        {
          dryRun: report.dryRun,
          readyMembers: report.readyMembers,
          skippedMembers: report.skippedMembers.length,
          writtenUsers: report.writtenUsers,
          writtenSocialAccounts: report.writtenSocialAccounts,
          writtenPointEntries: report.writtenPointEntries,
          reportPath,
        },
        null,
        2,
      ),
    );
  })
  .catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
