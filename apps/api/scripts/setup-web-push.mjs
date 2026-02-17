import webpush from 'web-push';

const usage = () => {
  console.error('Usage: node scripts/setup-web-push.mjs [--subject <mailto:...>]');
};

const parseArgs = (argv) => {
  let subject = 'mailto:you@example.com';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--subject') {
      const next = argv[index + 1];
      if (!next) {
        usage();
        process.exit(1);
      }
      subject = next.trim();
      index += 1;
      continue;
    }

    usage();
    process.exit(1);
  }

  if (!subject.startsWith('mailto:')) {
    console.error('Error: --subject must start with "mailto:".');
    process.exit(1);
  }

  return { subject };
};

const printBlock = (title, values) => {
  console.log(title);
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }
  console.log('');
};

const { subject } = parseArgs(process.argv.slice(2));
const keys = webpush.generateVAPIDKeys();

const apiValues = {
  WEB_PUSH_VAPID_PUBLIC_KEY: keys.publicKey,
  WEB_PUSH_VAPID_PRIVATE_KEY: keys.privateKey,
  WEB_PUSH_VAPID_SUBJECT: subject,
};

const webValues = {
  NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: keys.publicKey,
};

console.log('Generated Web Push configuration (copy/paste into env files):');
console.log('');
printBlock('API variables (apps/api/.env.local or API host env):', apiValues);
printBlock('Web variable (apps/web/.env.local or web host env):', webValues);
