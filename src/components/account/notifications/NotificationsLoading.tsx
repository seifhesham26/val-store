export function NotificationsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Notifications</h2>
        <p className="text-gray-400">Updates on your orders and saved items.</p>
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-white/[0.06] rounded-lg animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
