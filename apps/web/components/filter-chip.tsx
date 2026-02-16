import Link from 'next/link';

interface FilterChipProps {
  href: string;
  label: string;
  active: boolean;
}

export const FilterChip = ({ href, label, active }: FilterChipProps) => {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition ${
        active
          ? 'border-accent bg-accent text-white'
          : 'border-emerald-100 bg-white text-ink hover:border-accent hover:text-accent'
      }`}
    >
      {label}
    </Link>
  );
};
