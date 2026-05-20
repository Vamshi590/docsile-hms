export default async function ModuleDisabledPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">Module not in your plan</h1>
        <p className="text-sm text-slate-600">
          {sp.module ? (
            <>
              The <code className="rounded bg-slate-100 px-1 font-mono">{sp.module}</code>{" "}
              module is not included in your current plan.
            </>
          ) : (
            "This module is not included in your current plan."
          )}
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Contact your administrator to upgrade.
        </p>
      </div>
    </div>
  );
}
