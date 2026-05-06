import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">404</p>
        <h1 className="text-2xl font-semibold mb-3">Session not found</h1>
        <p className="text-zinc-400 mb-6">
          This session has expired or never existed. Sessions are kept for 24h after creation.
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white rounded-md px-5 py-2 text-sm transition"
        >
          Create a new session
        </Link>
      </div>
    </div>
  );
}
