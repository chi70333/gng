#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const PROJECT_PREFIX = '[GNG]';

const args = process.argv.slice(2);

const hasFlag = (name) => args.includes(name);

const readOption = (names) => {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index !== -1) return args[index + 1];
  }

  const inline = args.find((arg) => names.some((name) => arg.startsWith(`${name}=`)));
  return inline?.split('=').slice(1).join('=');
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

const output = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
};

const help = () => {
  console.log(`
Usage:
  pnpm ship --message "[GNG] 작업 내용"
  pnpm ship --preview --message "[GNG] 미리보기 배포"

Options:
  -m, --message <text>  커밋 메시지. [GNG] 접두어가 없으면 자동으로 붙입니다.
  --preview            Vercel preview 배포를 실행합니다. 기본값은 production 배포입니다.
  --no-verify          typecheck/lint/test 검증을 건너뜁니다.
  --build              배포 전 pnpm build를 추가로 실행합니다.
  --no-deploy          커밋과 push까지만 실행합니다.
  --help               도움말을 출력합니다.
`);
};

if (hasFlag('--help') || hasFlag('-h')) {
  help();
  process.exit(0);
}

const branch = output('git', ['branch', '--show-current']);

if (!branch) {
  console.error('현재 Git 브랜치를 확인할 수 없습니다.');
  process.exit(1);
}

const rawMessage =
  readOption(['--message', '-m']) ||
  `자동 배포 ${new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Seoul',
    hour12: false,
  })}`;

const commitMessage = rawMessage.startsWith(PROJECT_PREFIX)
  ? rawMessage
  : `${PROJECT_PREFIX} ${rawMessage}`;

if (!hasFlag('--no-verify')) {
  run('pnpm', ['typecheck']);
  run('pnpm', ['lint']);
  run('pnpm', ['test']);
}

if (hasFlag('--build')) {
  run('pnpm', ['build']);
}

const statusBeforeAdd = output('git', ['status', '--porcelain']);

if (statusBeforeAdd) {
  run('git', ['add', '-A']);
  run('git', ['commit', '-m', commitMessage]);
} else {
  console.log('커밋할 변경사항이 없어 커밋 단계를 건너뜁니다.');
}

run('git', ['push', 'origin', branch]);

if (!hasFlag('--no-deploy')) {
  const vercelArgs = ['dlx', 'vercel', '--yes'];

  if (!hasFlag('--preview')) {
    vercelArgs.push('--prod');
  }

  run('pnpm', vercelArgs);
}
