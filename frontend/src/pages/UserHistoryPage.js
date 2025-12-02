import React, { useEffect, useState } from 'react';
import { historyAPI } from '../api/history';
import { Calendar, Filter, Download, Search, MapPin, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const UserHistoryPage = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ status: 'all', startDate: '', endDate: '', minAmount: '', maxAmount: '' });

  const load = async (p = 1) => {
    try {
      setIsLoading(true);
      const params = { page: p, limit: 10 };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.minAmount) params.minAmount = filters.minAmount;
      if (filters.maxAmount) params.maxAmount = filters.maxAmount;
      const res = await historyAPI.getUserHistory(params);
      if (res.success) {
        setItems(res.data.requests);
        setTotalPages(res.data.pagination.pages);
        setPage(res.data.pagination.current);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const exportCsv = async () => {
    try {
      const res = await historyAPI.exportUserHistory('csv');
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user-history.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Request History</h1>
            <p className="text-gray-600">View your past requests and payments</p>
          </div>
          <button onClick={exportCsv} className="btn btn-outline flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="bg-white rounded-xl shadow-soft p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select value={filters.status} onChange={e=>setFilters({ ...filters, status: e.target.value })} className="select w-full">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="arrived">Arrived</option>
              <option value="working">Working</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input type="date" className="input w-full" value={filters.startDate} onChange={e=>setFilters({ ...filters, startDate: e.target.value })} />
            <input type="date" className="input w-full" value={filters.endDate} onChange={e=>setFilters({ ...filters, endDate: e.target.value })} />
            <input type="number" placeholder="Min ৳" className="input w-full" value={filters.minAmount} onChange={e=>setFilters({ ...filters, minAmount: e.target.value })} />
            <input type="number" placeholder="Max ৳" className="input w-full" value={filters.maxAmount} onChange={e=>setFilters({ ...filters, maxAmount: e.target.value })} />
          </div>
          <div className="mt-4 text-right">
            <button className="btn btn-primary" onClick={()=>load(1)}>Apply Filters</button>
          </div>
        </motion.div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center"><LoadingSpinner size="lg" text="Loading history..." /></div>
        ) : (
          <div className="space-y-4">
            {items.map((r)=> (
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
                      {r.rating?.userRating && <span className="flex items-center space-x-1"><Star className="w-4 h-4 text-yellow-400" /><span>{r.rating.userRating}</span></span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="font-semibold">৳{r.actualCost || r.estimatedCost || 0}</div>
                    <div className="text-xs text-gray-500 capitalize mt-1">Payment: {(r.paymentStatus || 'pending').replace('payment_','')}</div>
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

export default UserHistoryPage;


