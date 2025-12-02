import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../../api/admin';
import { useSocket } from '../../context/SocketContext';
import { motion } from 'framer-motion';
import { Users, Wrench, ClipboardList, BarChart3, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

const AdminPanel = () => {
  const { on } = useSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [requests, setRequests] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [mechQuery, setMechQuery] = useState('');
  const [reqQuery, setReqQuery] = useState('');

  // Client-side filtered datasets (lightweight, last 10 rows)
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => `${u.name || ''} ${u.phone || ''}`.toLowerCase().includes(q));
  }, [users, userQuery]);

  const filteredMechanics = useMemo(() => {
    const q = mechQuery.trim().toLowerCase();
    if (!q) return mechanics;
    return mechanics.filter(m => `${m.userId?.name || ''} ${m.verificationStatus || ''}`.toLowerCase().includes(q));
  }, [mechanics, mechQuery]);

  const filteredRequests = useMemo(() => {
    const q = reqQuery.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(r => `${r.problemType || ''} ${r.status || ''} ${r.vehicleType || ''}`.toLowerCase().includes(q));
  }, [requests, reqQuery]);

  const loadAll = async () => {
    try {
      setIsLoading(true);
      const [dash, us, me, reqs] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.listUsers({ limit: 10 }),
        adminAPI.listMechanics({ limit: 10 }),
        adminAPI.listRequests({ limit: 10 })
      ]);
      if (dash.success) setDashboard(dash.data);
      if (us.success) setUsers(us.data.users);
      if (me.success) setMechanics(me.data.mechanics);
      if (reqs.success) setRequests(reqs.data.requests);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const unsubStatus = on('request_status_changed', () => loadAll());
    const unsubPayment = on('request:payment_completed', () => loadAll());
    return () => { unsubStatus(); unsubPayment(); };
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" text="Loading admin panel..." /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500 text-sm mt-1">Monitor platform activity and manage users, mechanics, and requests.</p>
          </div>
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white shadow-sm hover:bg-gray-50 active:shadow-none" onClick={loadAll}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Overview */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[{
            label: 'Users', value: dashboard?.overview?.totalUsers, Icon: Users, color: 'text-blue-600', chip: dashboard?.overview?.newUsers24h ? `+${dashboard.overview.newUsers24h} today` : null
          }, {
            label: 'Mechanics', value: dashboard?.overview?.totalMechanics, Icon: Wrench, color: 'text-green-600', chip: dashboard?.overview?.newMechanics24h ? `+${dashboard.overview.newMechanics24h} today` : null
          }, {
            label: 'Total Requests', value: dashboard?.overview?.totalRequests, Icon: ClipboardList, color: 'text-purple-600', chip: dashboard?.overview?.activeRequests ? `${dashboard.overview.activeRequests} active` : null
          }, {
            label: 'Revenue', value: `BDT ${dashboard?.overview?.totalRevenue || 0}`, Icon: BarChart3, color: 'text-rose-600', chip: dashboard?.overview?.revenueThisMonth ? `MTD ${dashboard.overview.revenueThisMonth}` : null
          }].map((c, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-soft p-6 border border-gray-100">
              <div className="flex items-start justify-between">
            <div>
                  <p className="text-sm text-gray-600">{c.label}</p>
                  <p className="text-3xl font-extrabold mt-1">{c.value}</p>
                  {c.chip && <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.chip}</span>}
            </div>
                <div className={`w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center ${c.color}`}>
                  <c.Icon className="w-5 h-5" />
            </div>
          </div>
            </div>
          ))}
        </motion.div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users table */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">Recent Users</h3>
              <div className="flex items-center gap-3">
                <input value={userQuery} onChange={e=>setUserQuery(e.target.value)} placeholder="Search name or phone" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-500">Last 10</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                  <tr>
                    <th className="text-left font-medium px-5 py-2">Name</th>
                    <th className="text-left font-medium px-5 py-2">Phone</th>
                    <th className="text-left font-medium px-5 py-2">Status</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map(u => (
                    <tr key={u._id} className="hover:bg-gray-50">
                      <td className="px-5 py-2 font-medium">{u.name}</td>
                      <td className="px-5 py-2 text-gray-600">{u.phone || '-'}</td>
                      <td className="px-5 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-right">
                        <button className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50" onClick={async ()=>{ await adminAPI.updateUserStatus(u._id, !u.isActive); toast.success('Status updated'); loadAll(); }}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mechanics table */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">Recent Mechanics</h3>
              <div className="flex items-center gap-3">
                <input value={mechQuery} onChange={e=>setMechQuery(e.target.value)} placeholder="Search name or status" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-500">Last 10</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                  <tr>
                    <th className="text-left font-medium px-5 py-2">Name</th>
                    <th className="text-left font-medium px-5 py-2">Verification</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMechanics.map(m => (
                    <tr key={m._id} className="hover:bg-gray-50">
                      <td className="px-5 py-2 font-medium">{m.userId?.name}</td>
                      <td className="px-5 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${m.verificationStatus === 'verified' ? 'bg-green-100 text-green-700' : m.verificationStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {m.verificationStatus || 'pending'}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-right space-x-2">
                        <button className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50" onClick={async ()=>{ await adminAPI.updateMechanicVerification(m._id, 'verified'); toast.success('Verified'); loadAll(); }}>Verify</button>
                        <button className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50" onClick={async ()=>{ await adminAPI.updateMechanicVerification(m._id, 'rejected'); toast.success('Rejected'); loadAll(); }}>Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                  </div>
          </div>

          {/* Requests table */}
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">Recent Requests</h3>
              <div className="flex items-center gap-3">
                <input value={reqQuery} onChange={e=>setReqQuery(e.target.value)} placeholder="Search type, vehicle or status" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-500">Last 10</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                  <tr>
                    <th className="text-left font-medium px-5 py-2">Type</th>
                    <th className="text-left font-medium px-5 py-2">Vehicle</th>
                    <th className="text-left font-medium px-5 py-2">Status</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRequests.map(r => (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-5 py-2 capitalize">{r.problemType?.replace('_',' ') || '-'}</td>
                      <td className="px-5 py-2 capitalize">{r.vehicleType || '-'}</td>
                      <td className="px-5 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${r.status === 'completed' ? 'bg-green-100 text-green-700' : r.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-right space-x-2">
                        <button className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50" onClick={async ()=>{ await adminAPI.updateRequestStatus(r._id, 'completed'); toast.success('Marked completed'); loadAll(); }}>Complete</button>
                        <button className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50" onClick={async ()=>{ await adminAPI.updateRequestStatus(r._id, 'cancelled'); toast.success('Cancelled'); loadAll(); }}>Cancel</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                  </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;


