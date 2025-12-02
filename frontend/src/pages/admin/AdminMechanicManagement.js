import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Star,
  MapPin,
  Phone,
  Mail,
  Wrench,
  Car,
  User,
  MoreVertical
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

const AdminMechanicManagement = () => {
  const [mechanics, setMechanics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadMechanics();
  }, []);

  const loadMechanics = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/mechanics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMechanics(data.data.mechanics);
      } else {
        toast.error('Failed to load mechanics');
      }
    } catch (error) {
      console.error('Error loading mechanics:', error);
      toast.error('Failed to load mechanics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (mechanicId, newStatus) => {
    try {
      setIsUpdating(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/mechanics/${mechanicId}/verification`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ verificationStatus: newStatus })
      });

      if (response.ok) {
        toast.success(`Mechanic ${newStatus} successfully`);
        loadMechanics();
        setShowDetails(false);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const filteredMechanics = mechanics.filter(mechanic => {
    const matchesSearch = mechanic.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mechanic.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mechanic.userId?.phone?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || mechanic.verificationStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getSkillLabel = (skill) => {
    const skillLabels = {
      'engine_repair': 'Engine Repair',
      'tire_change': 'Tire Change',
      'battery_jump': 'Battery Jump',
      'fuel_delivery': 'Fuel Delivery',
      'lockout_service': 'Lockout Service',
      'towing': 'Towing',
      'brake_repair': 'Brake Repair',
      'electrical_repair': 'Electrical Repair',
      'ac_repair': 'AC Repair',
      'general_maintenance': 'General Maintenance'
    };
    return skillLabels[skill] || skill;
  };

  const getVehicleTypeLabel = (type) => {
    const typeLabels = {
      'bike': 'Bike/Motorcycle',
      'car': 'Car',
      'truck': 'Truck',
      'bus': 'Bus'
    };
    return typeLabels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Mechanic Management</h1>
                <p className="text-gray-600">Manage mechanic registrations and verifications</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  Total: {mechanics.length} mechanics
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search mechanics..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mechanics List */}
          <div className="divide-y divide-gray-200">
            {filteredMechanics.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No mechanics found</h3>
                <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
              </div>
            ) : (
              filteredMechanics.map((mechanic) => (
                <div key={mechanic._id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        {mechanic.userId?.profileImage ? (
                          <img
                            src={mechanic.userId.profileImage}
                            alt={mechanic.userId.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${getStatusColor(mechanic.verificationStatus)}`}>
                          {getStatusIcon(mechanic.verificationStatus)}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {mechanic.userId?.name}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(mechanic.verificationStatus)}`}>
                            {mechanic.verificationStatus}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-6 mt-2 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-1" />
                            {mechanic.userId?.phone}
                          </div>
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            {mechanic.userId?.email}
                          </div>
                          <div className="flex items-center">
                            <Star className="w-4 h-4 mr-1" />
                            {mechanic.rating?.toFixed(1)} ({mechanic.totalRatings} reviews)
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {mechanic.experience} years experience
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <Wrench className="w-4 h-4 mr-1 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                {mechanic.skills?.slice(0, 3).map(getSkillLabel).join(', ')}
                                {mechanic.skills?.length > 3 && ` +${mechanic.skills.length - 3} more`}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Car className="w-4 h-4 mr-1 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                {mechanic.vehicleTypes?.map(getVehicleTypeLabel).join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedMechanic(mechanic);
                          setShowDetails(true);
                        }}
                        className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </button>
                      
                      {mechanic.verificationStatus === 'pending' && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleStatusUpdate(mechanic._id, 'verified')}
                            disabled={isUpdating}
                            className="flex items-center px-3 py-2 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(mechanic._id, 'rejected')}
                            disabled={isUpdating}
                            className="flex items-center px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Mechanic Details Modal */}
        {showDetails && selectedMechanic && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Mechanic Details
                  </h2>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Basic Information */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Name</label>
                          <p className="text-gray-900">{selectedMechanic.userId?.name}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Email</label>
                          <p className="text-gray-900">{selectedMechanic.userId?.email}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Phone</label>
                          <p className="text-gray-900">{selectedMechanic.userId?.phone}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Experience</label>
                          <p className="text-gray-900">{selectedMechanic.experience} years</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedMechanic.skills?.map((skill, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                          >
                            {getSkillLabel(skill)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedMechanic.vehicleTypes?.map((type, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                          >
                            {getVehicleTypeLabel(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Service Information */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Information</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Service Radius</label>
                          <p className="text-gray-900">{selectedMechanic.serviceRadius} km</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Price Range</label>
                          <p className="text-gray-900">
                            ৳{selectedMechanic.priceRange?.min} - ৳{selectedMechanic.priceRange?.max}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Working Hours</label>
                          <p className="text-gray-900">
                            {selectedMechanic.workingHours?.start} - {selectedMechanic.workingHours?.end}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Garage Information</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Garage Name</label>
                          <p className="text-gray-900">{selectedMechanic.garage?.name}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Address</label>
                          <p className="text-gray-900">{selectedMechanic.garage?.address}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">NID Number</label>
                          <p className="text-gray-900">{selectedMechanic.documents?.nidNumber}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">License Number</label>
                          <p className="text-gray-900">{selectedMechanic.documents?.licenseNumber}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex justify-end space-x-4">
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  
                  {selectedMechanic.verificationStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          handleStatusUpdate(selectedMechanic._id, 'verified');
                          setShowDetails(false);
                        }}
                        disabled={isUpdating}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          handleStatusUpdate(selectedMechanic._id, 'rejected');
                          setShowDetails(false);
                        }}
                        disabled={isUpdating}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMechanicManagement;


