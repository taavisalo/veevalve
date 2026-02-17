import Link from 'next/link';

const NotFoundPage = () => {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">404</p>
      <h1 className="mt-3 text-3xl text-ink sm:text-4xl">Lehte ei leitud</h1>
      <p className="mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
        Otsitud leht puudub või aadress on vale. The page you requested could not be found.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-full border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
      >
        Tagasi avalehele
      </Link>
    </main>
  );
};

export default NotFoundPage;
