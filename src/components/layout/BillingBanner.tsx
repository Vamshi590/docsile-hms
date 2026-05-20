type BillingBannerProps = {
  message: string | null;
};

export function BillingBanner({ message }: BillingBannerProps) {
  if (!message) return null;
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <strong>Payment overdue.</strong> {message}
    </div>
  );
}
