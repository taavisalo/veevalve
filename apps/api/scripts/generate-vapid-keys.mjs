import webpush from 'web-push';

const printUsage = () => {
  console.error('Usage: node scripts/generate-vapid-keys.mjs [--env] [--subject <mailto:...>]');
};

const parseArgs = (argv) => {
  let asEnv = false;
  let subject = 'mailto:you@example.com';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === '--env') {
      asEnv = true;
      continue;
    }

    if (arg === '--subject') {
      const value = argv[index + 1];
      if (!value) {
        printUsage();
        process.exit(1);
      }

      subject = value;
      index += 1;
      continue;
    }

    printUsage();
    process.exit(1);
  }

  return {
    asEnv,
    subject,
  };
};

const { asEnv, subject } = parseArgs(process.argv.slice(2));
const keys = webpush.generateVAPIDKeys();

if (asEnv) {
  console.log(`WEB_PUSH_VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`WEB_PUSH_VAPID_PRIVATE_KEY=${keys.privateKey}`);
  console.log(`WEB_PUSH_VAPID_SUBJECT=${subject}`);
  process.exit(0);
}

console.log('VAPID keys generated:');
console.log(`Public key: ${keys.publicKey}`);
console.log(`Private key: ${keys.privateKey}`);
console.log(`Subject: ${subject}`);
console.log('');
console.log('You can print as .env lines with:');
console.log('  pnpm --filter @veevalve/api push:vapid -- --env --subject mailto:you@example.com');
