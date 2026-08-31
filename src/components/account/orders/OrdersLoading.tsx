export function OrdersLoading() {
  // Heading is real text, not a bar: it is known before the query resolves, and
  // rendering it now keeps the cards from jumping down when they arrive.
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Order History</h2>
        <p className="text-gray-400">View and track your past orders.</p>
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-30 bg-white/[0.06] rounded-lg animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
