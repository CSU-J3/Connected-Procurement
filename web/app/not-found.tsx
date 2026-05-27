import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-12">
      <h1 className="prose-sans text-xl font-semibold">404 · not found</h1>
      <p className="prose-sans text-sm text-[color:var(--color-muted)] mt-2">
        That route doesn&apos;t exist in the registry.
      </p>
      <p className="mt-4">
        <Link href="/" className="underline">
          ← back to the front door
        </Link>
      </p>
    </div>
  );
}
