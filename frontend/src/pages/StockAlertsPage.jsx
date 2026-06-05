import { BellRing, TrendingDown, TrendingUp, Check, CheckCheck, Inbox } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StockAlertsPage() {
  const { pendingAlerts, notifications, acknowledge, acknowledgeAll } = useNotifications();

  const acknowledgedAlerts = notifications.filter(
    n => n.is_acknowledged && (n.type === 'stop_loss' || n.type === 'target')
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <BellRing size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Stock Alerts</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pendingAlerts.length} pending · {acknowledgedAlerts.length} acknowledged
            </p>
          </div>
        </div>
        {pendingAlerts.length > 0 && (
          <button
            onClick={acknowledgeAll}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
          >
            <CheckCheck size={15} /> Acknowledge All
          </button>
        )}
      </div>

      {/* Pending alerts */}
      {pendingAlerts.length === 0 && acknowledgedAlerts.length === 0 ? (
        <div className="text-center py-24">
          <Inbox size={44} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="font-medium text-gray-500 dark:text-gray-400">No stock alert notifications yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Notifications appear here when a stock hits its stop loss or target.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending section */}
          {pendingAlerts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                Pending — {pendingAlerts.length}
              </p>
              <div className="space-y-2">
                {pendingAlerts.map(n => (
                  <div key={n.id}
                    className="flex items-start gap-4 p-4 rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50/60 dark:bg-orange-900/10"
                  >
                    <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${n.type === 'stop_loss' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                      {n.type === 'stop_loss'
                        ? <TrendingDown size={16} className="text-red-600 dark:text-red-400" />
                        : <TrendingUp size={16} className="text-green-600 dark:text-green-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${n.type === 'stop_loss' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                          {n.type === 'stop_loss' ? 'Stop Loss' : 'Target'}
                        </span>
                        <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                        {n.triggered_price && (
                          <span className="text-xs text-gray-400">at ₹{parseFloat(n.triggered_price).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => acknowledge(n.id)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Check size={13} /> Acknowledge
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acknowledged section */}
          {acknowledgedAlerts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                Acknowledged — {acknowledgedAlerts.length}
              </p>
              <div className="space-y-2">
                {acknowledgedAlerts.map(n => (
                  <div key={n.id}
                    className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 opacity-60"
                  >
                    <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${n.type === 'stop_loss' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                      {n.type === 'stop_loss'
                        ? <TrendingDown size={16} className="text-red-400" />
                        : <TrendingUp size={16} className="text-green-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug">{n.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                        {n.triggered_price && (
                          <span className="text-xs text-gray-400">at ₹{parseFloat(n.triggered_price).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400">
                      <Check size={12} /> Done
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
