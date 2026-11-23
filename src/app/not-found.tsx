import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <p className="text-sm text-muted">404</p>
      <h1 className="font-display text-4xl">No encontramos esa página.</h1>
      <Link href="/" className="mt-6 inline-block text-clay underline">
        Volver al inicio
      </Link>
    </main>
  );
}
