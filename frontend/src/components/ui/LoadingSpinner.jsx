export default function LoadingSpinner({ fullPage = false }) {
  const spinner = (
    <div className="flex items-center justify-center gap-2 text-brand-600">
      <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
    </div>
  );
  if (fullPage) {
    return <div className="flex items-center justify-center h-full min-h-[300px]">{spinner}</div>;
  }
  return spinner;
}
