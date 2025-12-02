import React, { useEffect, useMemo, useState } from 'react';
import { historyAPI } from '../../api/history';
import { mechanicsAPI } from '../../api/mechanics';
import { Calendar, MapPin, Star, Banknote, TrendingUp, Gauge, Briefcase, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const MechanicHistoryPage = () => {
  const { user, mechanic: authMechanic } = useAuth();
  const [summary, setSummary] = useState({ totalJobs: 0, earnings: 0, avgRating: 0 });
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ status: 'completed', startDate: '', endDate: '' });
  const [timePreset, setTimePreset] = useState('this_month');
  const [searchText, setSearchText] = useState('');

  // Helpers for date handling
  const toYMD = (d) => {
    if (!d) return '';
    const dd = new Date(d);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, '0');
    const day = String(dd.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const setQuickRange = (range) => {
    const today = new Date();
    const end = toYMD(today);
    let start;
    if (range === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = toYMD(d);
    } else if (range === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = toYMD(d);
    } else if (range === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      start = toYMD(d);
    } else if (range === 'clear') {
      setFilters((f) => ({ ...f, startDate: '', endDate: '' }));
      return;
    }
    setFilters((f) => ({ ...f, startDate: start, endDate: end }));
  };

  const handleApply = () => {
    const { startDate, endDate } = filters;
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (s > e) {
        toast.error('From Date cannot be after To Date');
        return;
      }
    }
    load(1);
  };
  const [analytics, setAnalytics] = useState(null);
  const [monthDeltaPct, setMonthDeltaPct] = useState(null);

  const load = async (p = 1) => {
    try {
      setIsLoading(true);
      const resSummary = await historyAPI.getMechanicSummary();
      if (resSummary.success) setSummary(resSummary.data);

      const params = { page: p, limit: 10 };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await historyAPI.getMechanicHistory(params);
      if (res.success) {
        setItems(res.data.requests);
        setTotalPages(res.data.pagination.pages);
        setPage(res.data.pagination.current);
      }

      // Load analytics using new endpoint (requires Mechanic document _id)
      let mechId = authMechanic?._id || null;
      // Fallback: fetch own mechanic profile
      if (!mechId) {
        try {
          const profileRes = await mechanicsAPI.getMyProfile();
          mechId = profileRes.data?.mechanic?._id;
        } catch (_) {}
      }
      if (mechId) {
        const anRes = await mechanicsAPI.getMechanicAnalytics(mechId);
        if (anRes.success) setAnalytics(anRes.data);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load mechanic history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  // React to preset changes (Today, This Week, This Month, Last Month, Custom)
  useEffect(() => {
    const today = new Date();
    const preset = timePreset;
    if (preset === 'custom') return; // don't override manual picks
    if (preset === 'today') {
      const s = toYMD(today);
      setFilters((f) => ({ ...f, startDate: s, endDate: s }));
    } else if (preset === 'this_week') {
      const day = today.getDay();
      const diffToMonday = (day + 6) % 7; // Monday as start
      const start = new Date(today);
      start.setDate(today.getDate() - diffToMonday);
      setFilters((f) => ({ ...f, startDate: toYMD(start), endDate: toYMD(today) }));
    } else if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilters((f) => ({ ...f, startDate: toYMD(start), endDate: toYMD(today) }));
    } else if (preset === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setFilters((f) => ({ ...f, startDate: toYMD(start), endDate: toYMD(end) }));
    }
  }, [timePreset]);

  const earningsSeries = useMemo(() => {
    if (!analytics?.earningsByMonth) return [];
    return analytics.earningsByMonth.map(e => ({ label: `${e._id.y}-${String(e._id.m).padStart(2,'0')}`, value: e.amount }));
  }, [analytics]);

  const ratingsSeries = useMemo(() => {
    if (!analytics?.ratingsTrend) return [];
    return analytics.ratingsTrend.map(r => ({ label: new Date(r.createdAt).toLocaleDateString(), value: r.rating }));
  }, [analytics]);

  // Compute earnings this month and delta
  const kpiEarningsThisMonth = useMemo(() => {
    if (!earningsSeries.length) return { current: 0, deltaPct: null };
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ymp = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
    const cur = earningsSeries.find(e => e.label === ym)?.value || 0;
    const prevVal = earningsSeries.find(e => e.label === ymp)?.value || 0;
    const deltaPct = prevVal === 0 ? (cur > 0 ? 100 : null) : Math.round(((cur - prevVal) / prevVal) * 100);
    return { current: cur, deltaPct };
  }, [earningsSeries]);

  useEffect(() => {
    setMonthDeltaPct(kpiEarningsThisMonth.deltaPct);
  }, [kpiEarningsThisMonth]);

  const avgPerJob = useMemo(() => {
    if (!summary?.totalJobs) return 0;
    return Math.round((summary.earnings || 0) / summary.totalJobs);
  }, [summary]);

  const monthlyCounts = useMemo(() => {
    if (!analytics?.earningsByMonth) return [];
    return analytics.earningsByMonth.map(e => ({ label: `${e._id.y}-${String(e._id.m).padStart(2,'0')}`, value: e.count || 0 }));
  }, [analytics]);

  const filteredItems = useMemo(() => {
    if (!searchText) return items;
    const q = searchText.toLowerCase();
    return items.filter(r =>
      String(r.problemType).toLowerCase().includes(q) ||
      String(r.pickupLocation?.address || '').toLowerCase().includes(q) ||
      String(r.userId?.name || '').toLowerCase().includes(q)
    );
  }, [items, searchText]);

  const recentReviews = useMemo(() => {
    if (!analytics?.recentCompleted) return [];
    return analytics.recentCompleted
      .filter(r => r?.rating?.userRating || r?.rating?.userComment)
      .slice(0, 4);
  }, [analytics]);

  const renderStars = (value) => {
    const rating = Math.round(Number(value || 0));
    return (
      <div className="flex items-center">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={`w-4 h-4 mr-0.5 ${i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* KPI Grid 2x3 */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Earnings (Lifetime) */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Total Earnings</p>
                <div className="mt-1 text-3xl font-extrabold text-gray-900">BDT {summary.earnings || 0}</div>
              </div>
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-50 to-emerald-100">
                <Banknote className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">Lifetime</div>
          </div>

          {/* Average Earnings per Job */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Avg per Job</p>
                <div className="mt-1 text-3xl font-extrabold text-gray-900">BDT {avgPerJob}</div>
              </div>
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100">
                <Briefcase className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">Based on completed jobs</div>
          </div>

          {/* Earnings This Month with comparison */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Earnings This Month</p>
                <div className="mt-1 flex items-end space-x-2">
                  <div className="text-3xl font-extrabold text-gray-900">BDT {kpiEarningsThisMonth.current}</div>
                  {monthDeltaPct !== null && (
                    <div className={`flex items-center text-sm font-medium ${monthDeltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {monthDeltaPct >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span className="ml-0.5">{Math.abs(monthDeltaPct)}%</span>
                      <span className="ml-1 text-gray-400">vs last month</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-100">
                <Banknote className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Total Jobs */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Total Jobs</p>
                <div className="mt-1 text-3xl font-extrabold text-gray-900">{summary.totalJobs}</div>
              </div>
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-100">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Job Completion Rate */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Job Completion Rate</p>
                <div className="mt-1 text-3xl font-extrabold text-gray-900">{analytics?.totals?.successRate || 0}%</div>
              </div>
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            {/* Mini trend (jobs count) */}
            {monthlyCounts.length > 1 && (
              <div className="mt-3">
                <Line
                  data={{
                    labels: monthlyCounts.map(m => m.label),
                    datasets: [{
                      data: monthlyCounts.map(m => m.value),
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16,185,129,0.15)',
                      tension: 0.4,
                      pointRadius: 0
                    }]
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }}
                  height={60}
                />
              </div>
            )}
          </div>

          {/* Average Rating with stars */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Average Rating</p>
                <div className="mt-1 flex items-center space-x-3">
                  <span className="text-3xl font-extrabold text-gray-900">{Number(summary.avgRating || 0).toFixed(1)}</span>
                  {renderStars(summary.avgRating)}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-50 to-amber-100">
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Analytics Overview */}
        {analytics && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-soft p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totals?.successRate || 0}%</p>
                </div>
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-soft p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Accept → Arrive</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round((analytics.responseTimes?.avgArriveMins || 0))}m</p>
                </div>
                <Gauge className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-soft p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Work Duration</p>
                  <p className="text-2xl font-bold text-gray-900">{Math.round((analytics.responseTimes?.avgCompleteMins || 0))}m</p>
                </div>
                <Gauge className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Charts Row */}
        {analytics && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Earnings Over Time</h3>
              <Bar
                data={{
                  labels: earningsSeries.map(e => e.label),
                  datasets: [{
                    label: 'Earnings',
                    data: earningsSeries.map(e => e.value),
                    backgroundColor: 'rgba(37, 99, 235, 0.25)',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    borderRadius: 6
                  }]
                }}
                options={{ responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f3f4f6' } } } }}
                height={160}
              />
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Ratings Trend</h3>
              <Line
                data={{
                  labels: ratingsSeries.map(e => e.label),
                  datasets: [{
                    label: 'Rating',
                    data: ratingsSeries.map(e => e.value),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    tension: 0.35,
                    pointRadius: 2
                  }]
                }}
                options={{ responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { min: 0, max: 5, ticks: { stepSize: 1 }, grid: { color: '#f3f4f6' } } } }}
                height={160}
              />
            </div>
          </motion.div>
        )}

        {/* Filters + Search */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Date Range</label>
              <select value={timePreset} onChange={(e)=>setTimePreset(e.target.value)} className="select w-full">
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {timePreset === 'custom' && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                  <input type="date" className="input w-full" value={filters.startDate} max={filters.endDate || undefined} onChange={(e)=>setFilters(f=>({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                  <input type="date" className="input w-full" value={filters.endDate} min={filters.startDate || undefined} onChange={(e)=>setFilters(f=>({ ...f, endDate: e.target.value }))} />
                </div>
              </>
            )}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={filters.status} onChange={e=>setFilters({ ...filters, status: e.target.value })} className="select w-full">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="arrived">Arrived</option>
                <option value="working">Working</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <input type="text" className="input w-full" placeholder="Search jobs by problem, address, or customer" value={searchText} onChange={(e)=>setSearchText(e.target.value)} />
            </div>
            <div className="md:col-span-1 flex space-x-2">
              <button className="btn btn-primary w-full" onClick={()=>load(1)}>Apply</button>
            </div>
          </div>
        </motion.div>

        {/* Top Feedback / Recent Reviews */}
        {recentReviews.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Most Recent Reviews</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentReviews.map((r) => (
                <div key={r._id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900 truncate">{r.userId?.name || 'Customer'}</div>
                    <div className="flex items-center">{renderStars(r.rating?.userRating)}</div>
                  </div>
                  {r.rating?.userComment && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-3">“{r.rating.userComment}”</p>
                  )}
                  <div className="mt-2 text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center"><LoadingSpinner size="lg" text="Loading history..." /></div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((r)=> (
              <div key={r._id} className="bg-white rounded-xl shadow-soft p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-gray-900 capitalize">{String(r.problemType).replace('_',' ')}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 capitalize">{r.status}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 flex items-center space-x-4">
                      <span className="flex items-center space-x-1"><Calendar className="w-4 h-4" /> <span>{new Date(r.createdAt).toLocaleString()}</span></span>
                      <span className="flex items-center space-x-1"><MapPin className="w-4 h-4" /> <span className="truncate max-w-xs">{r.pickupLocation?.address}</span></span>
                      {r.userId && <span className="text-xs text-gray-500">Customer: {r.userId.name}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="font-semibold">BDT {r.actualCost || r.estimatedCost || 0}</div>
                    {r.rating?.userRating && <div className="text-xs text-gray-500 mt-1 flex items-center justify-end space-x-1"><Star className="w-3 h-3 text-yellow-400" /><span>{r.rating.userRating}</span></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 mt-6">
            <button className="btn btn-outline btn-sm" disabled={page===1} onClick={()=>load(page-1)}>Prev</button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={page===totalPages} onClick={()=>load(page+1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MechanicHistoryPage;




