/**
 * Shared inline error banner - extracted from the identical
 * `bg-red-50 ... text-red-700` markup that used to be duplicated in nearly
 * every page that runs a mutation.
 */
export function ErrorBanner({ message, className = '' }: { message: string | null | undefined; className?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className={`rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`}>
      {message}
    </div>
  );
}
