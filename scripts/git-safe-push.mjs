#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as outputStream } from 'node:process';

const args = process.argv.slice(2);
const DEFAULT_REMOTE = 'origin';

const hasFlag = (name) => args.includes(name);

const readOption = (names) => {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index !== -1) return args[index + 1];
  }

  const inline = args.find((arg) => names.some((name) => arg.startsWith(`${name}=`)));
  return inline?.split('=').slice(1).join('=');
};

const readListOption = (names) => {
  const values = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const optionName = names.find((name) => arg === name || arg.startsWith(`${name}=`));

    if (!optionName) continue;

    if (arg.includes('=')) {
      values.push(...arg.split('=').slice(1).join('=').split(','));
      continue;
    }

    for (let valueIndex = index + 1; valueIndex < args.length; valueIndex += 1) {
      const value = args[valueIndex];
      if (value.startsWith('-')) break;
      values.push(...value.split(','));
      index = valueIndex;
    }
  }

  return values.map((value) => value.trim()).filter(Boolean);
};

const printHelp = () => {
  console.log(`
Usage:
  pnpm git:push --message "chore: 작업 내용"
  pnpm git:push -m "fix: 상품 저장 오류 수정" --yes
  pnpm git:push --files src/app/page.tsx src/components/shop/Header.tsx -m "feat: 메인 개선"

Options:
  -m, --message <text>   커밋 메시지. Conventional Commit 형식을 권장합니다.
  --files <paths...>     지정한 파일만 git add 합니다. 기본값은 전체 변경사항(add -A)입니다.
  --remote <name>        push할 remote 이름입니다. 기본값은 origin입니다.
  --branch <name>        push할 원격 브랜치명입니다. 기본값은 현재 브랜치입니다.
  --yes                  변경사항 확인 질문을 건너뜁니다.
  --dry-run              검증과 변경사항 확인만 하고 add/commit/push는 하지 않습니다.
  --no-verify            typecheck/lint/test 검증을 건너뜁니다.
  --no-test              test만 건너뜁니다. typecheck/lint는 실행합니다.
  --build                push 전 pnpm build를 추가로 실행합니다.
  --no-push              add/commit까지만 실행합니다.
  --help                 도움말을 출력합니다.
`);
};

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const commandOutput = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `${command} ${commandArgs.join(' ')} 실패`;
    console.error(message.trim());
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
};

const commandOutputRaw = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `${command} ${commandArgs.join(' ')} 실패`;
    console.error(message.trim());
    process.exit(result.status ?? 1);
  }

  return result.stdout;
};

const optionalCommandOutput = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) return null;

  return result.stdout.trim();
};

const confirm = async (question) => {
  if (hasFlag('--yes')) return true;

  const rl = createInterface({ input, output: outputStream });
  const answer = await rl.question(`${question} (y/N) `);
  rl.close();

  return ['y', 'yes'].includes(answer.trim().toLowerCase());
};

const formatKst = () =>
  new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Seoul',
    hour12: false,
  });

const countAheadCommits = (branch) => {
  const upstream = optionalCommandOutput('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!upstream) return null;

  const count = commandOutput('git', ['rev-list', '--count', `${upstream}..${branch}`]);
  return Number.parseInt(count, 10) || 0;
};

if (hasFlag('--help') || hasFlag('-h')) {
  printHelp();
  process.exit(0);
}

commandOutput('git', ['rev-parse', '--is-inside-work-tree']);

const branch = commandOutput('git', ['branch', '--show-current']);
if (!branch) {
  console.error('현재 Git 브랜치를 확인할 수 없습니다. detached HEAD 상태인지 확인하세요.');
  process.exit(1);
}

const remote = readOption(['--remote']) || DEFAULT_REMOTE;
const remoteBranch = readOption(['--branch']) || branch;
const files = readListOption(['--files']);
const commitMessage = readOption(['--message', '-m']) || `chore: 작업 내용 저장 ${formatKst()}`;

console.log(`현재 브랜치: ${branch}`);

if (!hasFlag('--no-verify')) {
  console.log('\n검증을 시작합니다.');
  run('pnpm', ['typecheck']);
  run('pnpm', ['lint']);

  if (!hasFlag('--no-test')) {
    run('pnpm', ['test']);
  }
}

if (hasFlag('--build')) {
  console.log('\n빌드를 확인합니다.');
  run('pnpm', ['build']);
}

const status = commandOutputRaw('git', ['status', '--short']);
if (!status.trim()) {
  console.log('\n커밋할 변경사항이 없습니다.');

  const aheadCount = countAheadCommits(branch);
  if (aheadCount === 0) {
    console.log('원격으로 올릴 로컬 커밋도 없습니다.');
    process.exit(0);
  }

  if (aheadCount === null) {
    console.log('현재 브랜치에 연결된 원격 추적 브랜치가 없습니다.');
  } else {
    console.log(`원격보다 앞선 커밋 ${aheadCount}개가 있습니다.`);
  }
  if (hasFlag('--dry-run') || hasFlag('--no-push')) {
    console.log('push 단계는 실행하지 않았습니다.');
    process.exit(0);
  }

  const shouldPushOnly = await confirm(`${remote}/${remoteBranch}로 push할까요?`);
  if (!shouldPushOnly) {
    console.log('push를 취소했습니다.');
    process.exit(0);
  }

  run('git', ['push', '-u', remote, `${branch}:${remoteBranch}`]);
  process.exit(0);
}

console.log('\n변경 파일:');
console.log(status.trimEnd());

console.log('\n변경 통계:');
run('git', ['diff', '--stat']);

const untrackedFiles = commandOutputRaw('git', ['ls-files', '--others', '--exclude-standard']).trim();
if (untrackedFiles) {
  console.log('\n새 파일:');
  console.log(untrackedFiles);
}

if (hasFlag('--dry-run')) {
  console.log('\ndry-run 모드라 add/commit/push는 실행하지 않았습니다.');
  process.exit(0);
}

const stageDescription =
  files.length > 0 ? `${files.join(', ')} 파일만 add` : '전체 변경사항을 add -A';
const shouldContinue = await confirm(`${stageDescription} 후 commit/push를 진행할까요?`);

if (!shouldContinue) {
  console.log('작업을 취소했습니다.');
  process.exit(0);
}

if (files.length > 0) {
  run('git', ['add', '--', ...files]);
} else {
  run('git', ['add', '-A']);
}

const stagedStatus = commandOutput('git', ['diff', '--cached', '--name-only']);
if (!stagedStatus) {
  console.error('스테이징된 변경사항이 없습니다. --files 경로를 다시 확인하세요.');
  process.exit(1);
}

run('git', ['commit', '-m', commitMessage]);

if (hasFlag('--no-push')) {
  console.log('\n--no-push 옵션으로 push는 실행하지 않았습니다.');
  process.exit(0);
}

run('git', ['push', '-u', remote, `${branch}:${remoteBranch}`]);
