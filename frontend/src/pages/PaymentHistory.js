import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Download, 
  Calendar, 
  Filter,
  Search,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Smartphone,
  Banknote
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { paymentsAPI } from '../api/payments';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const PaymentHistory = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    method: '',
    status: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10
  });
  const [showFilters, setShowFilters] = useState(false);

  const loadPayments = async (page = 1) => {
    try {
      setIsLoading(true);
      const response = await paymentsAPI.getUserPayments(page, pagination.limit, filters);
      
      if (response.success) {
        setPayments(response.data.payments);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
      toast.error('Failed to load payment history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      method: '',
      status: '',
      startDate: '',
      endDate: ''
    });
  };

  const getPaymentMethodIcon = (method) => {
    const icons = {
      bkash: '📱',
      nagad: '📱',
      rocket: '📱',
      card: '💳',
      cash: '💵'
    };
    return icons[method] || '💳';
  };

  const getPaymentMethodColor = (method) => {
    const colors = {
      bkash: 'text-pink-600 bg-pink-100',
      nagad: 'text-red-600 bg-red-100',
      rocket: 'text-blue-600 bg-blue-100',
      card: 'text-green-600 bg-green-100',
      cash: 'text-orange-600 bg-orange-100'
    };
    return colors[method] || 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status) => {
    const icons = {
      completed: <CheckCircle className="w-4 h-4 text-green-600" />,
      processing: <Clock className="w-4 h-4 text-yellow-600" />,
      failed: <XCircle className="w-4 h-4 text-red-600" />
    };
    return icons[status] || <Clock className="w-4 h-4 text-gray-600" />;
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'text-green-600 bg-green-100',
      processing: 'text-yellow-600 bg-yellow-100',
      failed: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const downloadInvoice = async (paymentId) => {
    try {
      const blob = await paymentsAPI.getPaymentInvoice(paymentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${paymentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded successfully!');
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading payment history..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center space-x-4 mb-4"
          >
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-ghost p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Payment History</h1>
              <p className="text-gray-600">View and manage your payment records</p>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white rounded-xl shadow-soft p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn btn-outline flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={filters.method}
                    onChange={(e) => handleFilterChange('method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">All Methods</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={clearFilters}
                className="btn btn-outline"
              >
                Clear Filters
              </button>
              <div className="text-sm text-gray-600">
                Showing {pagination.total} payments
              </div>
            </div>
          </motion.div>
        </div>

        {/* Payment List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-4"
        >
          {payments.length === 0 ? (
            <div className="bg-white rounded-xl shadow-soft p-8 text-center">
              <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payments Found</h3>
              <p className="text-gray-600 mb-6">You haven't made any payments yet.</p>
              <button
                onClick={() => navigate('/find-mechanics')}
                className="btn btn-primary"
              >
                Request Service
              </button>
            </div>
          ) : (
            payments.map((payment, index) => (
              <motion.div
                key={payment._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-soft p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getPaymentMethodColor(payment.method)}`}>
                      <span className="text-xl">{getPaymentMethodIcon(payment.method)}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {payment.method.toUpperCase()} Payment
                      </h3>
                      <p className="text-sm text-gray-600">
                        {payment.requestId?.vehicleType} - {payment.requestId?.problemType}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        BDT {payment.amount.toFixed(2)}
                      </div>
                      <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        {getStatusIcon(payment.status)}
                        <span className="capitalize">{payment.status}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => downloadInvoice(payment._id)}
                        className="btn btn-outline btn-sm flex items-center space-x-1"
                      >
                        <Download className="w-4 h-4" />
                        <span>Invoice</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Transaction ID:</span>
                      <p className="font-medium">{payment.transactionId}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Commission:</span>
                      <p className="font-medium">BDT {payment.commissionAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Net to Mechanic:</span>
                      <p className="font-medium">BDT {payment.netToMechanic.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Mechanic:</span>
                      <p className="font-medium">{payment.mechanicId?.userId?.name || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center justify-center space-x-2 mt-8"
          >
            <button
              onClick={() => loadPayments(pagination.current - 1)}
              disabled={pagination.current === 1}
              className="btn btn-outline btn-sm disabled:opacity-50"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => loadPayments(page)}
                  className={`btn btn-sm ${
                    page === pagination.current ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => loadPayments(pagination.current + 1)}
              disabled={pagination.current === pagination.pages}
              className="btn btn-outline btn-sm disabled:opacity-50"
            >
              Next
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;
