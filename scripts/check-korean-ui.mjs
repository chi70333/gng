import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const targets = ['src/app/(shop)', 'src/app/page.tsx', 'src/components'];

const forbiddenPhrases = [
  'Add to cart',
  'Go to cart',
  'Checkout',
  'Continue shopping',
  'Your cart is empty',
  'Create account',
  'Find account',
  'Request recovery',
  'Place order',
  'Search products',
  'Enter a keyword to search products',
  'Payment provider integration',
  'Payment integration will be connected',
  'Order received',
  'Order number',
  'Best-selling products',
  'Recently added products',
  'Email or password is incorrect',
  'Please enter a valid email',
  'Please check the required fields',
  'Please select all options',
  'Could not add item to cart',
  'Added to cart',
];

const fileExtensions = new Set(['.ts', '.tsx']);

function extensionOf(filePath) {
  const index = filePath.lastIndexOf('.');
  return index === -1 ? '' : filePath.slice(index);
}

function listFiles(target) {
  const stat = statSync(target);
  if (stat.isFile()) return [target];

  return readdirSync(target).flatMap((entry) => {
    const path = join(target, entry);
    const entryStat = statSync(path);
    return entryStat.isDirectory() ? listFiles(path) : [path];
  });
}

const failures = [];

for (const target of targets) {
  for (const file of listFiles(target)) {
    if (!fileExtensions.has(extensionOf(file))) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const phrase of forbiddenPhrases) {
        if (line.includes(phrase)) {
          failures.push(`${file}:${index + 1} contains "${phrase}"`);
        }
      }
    });
  }
}

if (failures.length > 0) {
  console.error('고객용 UI에는 한국어 문구를 사용해 주세요.');
  console.error(failures.join('\n'));
  process.exit(1);
}

