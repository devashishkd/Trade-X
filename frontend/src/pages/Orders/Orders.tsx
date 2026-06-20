import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { ListOrdered, RefreshCw } from 'lucide-react';

interface OrderRecord {
  orderId:         string;
  symbol:          string;
  side:            'BUY' | 'SELL';
  type:            'LIMIT' | 'MARKET';
  status:          'PENDING' | 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  price:           any;
  quantity:        number;
  filledQuantity:  number;
  createdAt:       string;
}

type TabFilter = 'ALL' | 'OPEN' | 'FILLED' | 'CANCELLED';

const TAB_FILTERS: { key: TabFilter; label: string }[] = [
  { key: 'ALL',       label: 'All' },
  { key: 'OPEN',      label: 'Open' },
  { key: 'FILLED',    label: 'Filled' },
  { key: 'CANCELLED', label: 'Cancelled / Rejected' },
];

const OPEN_STATUSES  = new Set(['PENDING', 'OPEN', 'PARTIAL']);
const FILL_STATUSES  = new Set(['FILLED']);
const CANCEL_STATUSES = new Set(['CANCELLED', 'REJECTED']);

const statusColor = (s: string) => {
  if (OPEN_STATUSES.has(s))   return 'status-badge--amber';
  if (FILL_STATUSES.has(s))   return 'status-badge--green';
  if (CANCEL_STATUSES.has(s)) return 'status-badge--gray';
  return 'status-badge--gray';
};

const getPrice = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return v.$numberDecimal || null;
};

const istTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

export const Orders: React.FC = () => {
  const [orders,  setOrders]  = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<TabFilter>('ALL');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.get('/orders?limit=200');
      if (res.data.success) setOrders(res.data.data.orders || res.data.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh open orders every 4 seconds while on the OPEN tab
  useEffect(() => {
    if (tab !== 'OPEN') return;
    const id = setInterval(fetchOrders, 4000);
    return () => clearInterval(id);
  }, [tab, fetchOrders]);

  const handleCancel = async (orderId: string) => {
    setCancelling(orderId);
    try {
      await apiClient.delete(`/orders/${orderId}`);
      await fetchOrders();
    } catch { /* silent */ } finally {
      setCancelling(null);
    }
  };

  // Cancel all open
  const handleCancelAll = async () => {
    const openOrders = orders.filter((o) => OPEN_STATUSES.has(o.status));
    await Promise.allSettled(openOrders.map((o) => apiClient.delete(`/orders/${o.orderId}`)));
    await fetchOrders();
  };

  const filtered = orders.filter((o) => {
    if (tab === 'ALL')       return true;
    if (tab === 'OPEN')      return OPEN_STATUSES.has(o.status);
    if (tab === 'FILLED')    return FILL_STATUSES.has(o.status);
    if (tab === 'CANCELLED') return CANCEL_STATUSES.has(o.status);
    return true;
  });

  const openCount = orders.filter((o) => OPEN_STATUSES.has(o.status)).length;

  if (loading) {
    return <div className="page-loading"><div className="chart-loading-spinner" /><span>Loading orders…</span></div>;
  }

  return (
    <div className="data-page">
      <div className="data-page-header">
        <div>
          <h1 className="data-page-title flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-indigo-400" /> Orders
          </h1>
          <p className="data-page-sub">{orders.length} total · {openCount} open</p>
        </div>
        <div className="flex items-center gap-3">
          {openCount > 0 && (
            <button onClick={handleCancelAll} className="orders-cancel-all-btn" id="cancel-all-orders">
              Cancel All Open ({openCount})
            </button>
          )}
          <button onClick={fetchOrders} className="orders-refresh-btn" id="refresh-orders" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {TAB_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            id={`orders-tab-${key.toLowerCase()}`}
            onClick={() => setTab(key)}
            className={`filter-tab ${tab === key ? 'filter-tab--active' : ''}`}
          >
            {label}
            {key === 'OPEN' && openCount > 0 && (
              <span className="filter-tab-badge">{openCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="data-th">Time (IST)</th>
              <th className="data-th">Symbol</th>
              <th className="data-th">Side</th>
              <th className="data-th">Type</th>
              <th className="data-th data-th--right">Price (₹)</th>
              <th className="data-th data-th--right">Qty</th>
              <th className="data-th data-th--right">Filled</th>
              <th className="data-th data-th--center">Status</th>
              <th className="data-th data-th--center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="data-td-empty">
                  No {tab.toLowerCase()} orders.{' '}
                  <Link to="/market" className="text-indigo-400 hover:underline">Go to Market</Link>
                </td>
              </tr>
            ) : (
              filtered.map((o) => {
                const priceStr = getPrice(o.price);
                const price    = priceStr ? `₹${parseFloat(priceStr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Market';
                const isBuy    = o.side === 'BUY';
                const canCancel = OPEN_STATUSES.has(o.status);
                const fillPct  = o.quantity > 0 ? (o.filledQuantity / o.quantity) * 100 : 0;

                return (
                  <tr key={o.orderId} className="data-row">
                    <td className="data-td text-gray-400 text-xs whitespace-nowrap">{istTime(o.createdAt)}</td>
                    <td className="data-td">
                      <Link to={`/trade/${o.symbol}`} onClick={(e) => e.stopPropagation()}>
                        <span className="market-symbol-badge">{o.symbol}</span>
                      </Link>
                    </td>
                    <td className="data-td">
                      <span className={`side-badge ${isBuy ? 'side-badge--buy' : 'side-badge--sell'}`}>{o.side}</span>
                    </td>
                    <td className="data-td text-gray-400 text-xs">{o.type}</td>
                    <td className="data-td data-td--right data-td--mono">{price}</td>
                    <td className="data-td data-td--right data-td--mono">{o.quantity.toLocaleString('en-IN')}</td>
                    <td className="data-td data-td--right">
                      <div className="data-td--mono text-xs">{o.filledQuantity}/{o.quantity}</div>
                      <div className="order-fill-bar">
                        <div className="order-fill-fill" style={{ width: `${fillPct}%` }} />
                      </div>
                    </td>
                    <td className="data-td data-td--center">
                      <span className={`status-badge ${statusColor(o.status)}`}>{o.status}</span>
                    </td>
                    <td className="data-td data-td--center">
                      {canCancel ? (
                        <button
                          onClick={() => handleCancel(o.orderId)}
                          disabled={cancelling === o.orderId}
                          className="orders-cancel-btn"
                          id={`cancel-order-${o.orderId}`}
                        >
                          {cancelling === o.orderId ? '…' : 'Cancel'}
                        </button>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
