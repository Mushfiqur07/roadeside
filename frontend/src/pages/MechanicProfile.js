import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mechanicsAPI } from '../api/mechanics';
import { MapPin, Phone, ShieldCheck, Star, Wrench, CheckCircle2, Clock, Award, MessageCircle, Heart } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import Map from '../components/Map';
import { useSocket } from '../context/SocketContext';
import toast from 'react-hot-toast';

export default function MechanicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isConnected } = useSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await mechanicsAPI.getMechanicById(id);
        if (res.success) setData(res.data.mechanic);
        else toast.error('Failed to load mechanic profile');
      } catch (e) {
        toast.error('Failed to load mechanic profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const center = useMemo(() => {
    const coords = data?.currentLocation?.coordinates?.length === 2
      ? [data.currentLocation.coordinates[1], data.currentLocation.coordinates[0]]
      : (data?.garage?.location?.coordinates?.length === 2
          ? [data.garage.location.coordinates[1], data.garage.location.coordinates[0]]
          : null);
    return coords || [23.8103, 90.4125];
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading mechanic profile..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Mechanic profile not found</div>
      </div>
    );
  }

  const verificationBadges = [
    { label: 'ID', ok: !!data.documents?.nidNumber },
    { label: 'License', ok: !!data.documents?.licenseNumber },
    { label: 'Insurance', ok: data.verificationStatus === 'verified' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex items-center gap-4">
            <img src={data.userId?.profileImage || 'https://i.pravatar.cc/120'} alt="Mechanic" className="w-20 h-20 rounded-full object-cover" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{data.userId?.name || 'Mechanic'}</h1>
                {data.verificationStatus === 'verified' && <ShieldCheck className="w-5 h-5 text-green-600" title="Verified" />}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                <span className="inline-flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400" /> {data.rating?.toFixed(1)} ({data.totalRatings})</span>
                <span className="inline-flex items-center gap-1"><Wrench className="w-4 h-4" /> {data.completedJobs} jobs</span>
                <span className={`inline-flex items-center gap-1 ${data.isAvailable ? 'text-green-600' : 'text-gray-500'}`}>
                  <CheckCircle2 className="w-4 h-4" /> {data.isAvailable ? 'Available now' : 'Unavailable'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {verificationBadges.map(b => (
                  <span key={b.label} className={`text-xs px-2 py-0.5 rounded border ${b.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{b.label} {b.ok ? 'Verified' : 'Pending'}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setFavorite(v => !v)} className={`btn btn-outline flex items-center gap-2 ${favorite ? 'text-red-600 border-red-300' : ''}`}>
                <Heart className="w-4 h-4" /> {favorite ? 'Bookmarked' : 'Bookmark'}
              </button>
              <a href={`tel:${data.userId?.phone || ''}`} className="btn btn-primary flex items-center gap-2">
                <Phone className="w-4 h-4" /> Call
              </a>
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Services & Pricing */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Services & Pricing</h2>
                <div className="text-sm text-gray-600">৳{data.priceRange?.min} - ৳{data.priceRange?.max}</div>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                {(data.skills || []).map(s => {
                  const sp = data.servicePrices?.[s] || data.servicePrices?.get?.(s);
                  const label = s.replace('_',' ');
                  const priceText = sp && (typeof sp.min === 'number' || typeof sp.max === 'number')
                    ? `৳${sp.min ?? data.priceRange?.min} - ৳${sp.max ?? data.priceRange?.max}`
                    : `৳${data.priceRange?.min} - ৳${data.priceRange?.max}`;
                  return (
                    <div key={s} className="flex items-center justify-between border rounded px-3 py-2">
                      <span className="text-sm capitalize">{label}</span>
                      <span className="text-sm text-gray-700">{priceText}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                <div className="flex items-center gap-2"><Wrench className="w-4 h-4" /> Equipped: {(data.tools || []).map(t => t.replace('_',' ')).join(', ') || 'Standard toolkit'}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Estimated response: 20-45 mins</div>
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Customer Reviews</h2>
                <div className="text-sm text-gray-600">Average {data.rating?.toFixed(1)} / 5</div>
              </div>
              <div className="space-y-4 text-sm">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">Communication</div>
                    <div className="text-yellow-500">★★★★★</div>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">Punctuality</div>
                    <div className="text-yellow-500">★★★★☆</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Quality</div>
                    <div className="text-yellow-500">★★★★★</div>
                  </div>
                </div>
                <div className="text-gray-500">Detailed review list coming soon.</div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Availability & Map */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-3">Availability & Coverage</h2>
              <div className={`text-sm mb-3 ${data.isAvailable ? 'text-green-700' : 'text-gray-600'}`}>
                {data.isAvailable ? 'Available now' : 'Currently unavailable'} • Service radius {data.serviceRadius || 10} km
              </div>
              <div className="h-56 rounded overflow-hidden mb-3">
                <Map
                  center={center}
                  zoom={13}
                  height="14rem"
                  markers={[{ id: 'mech', lat: center[0], lng: center[1], color: '#10B981', size: 'large', popup: data.garage?.address || 'Mechanic' }]}
                />
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {data.garage?.address}</div>
            </div>

            {/* Communication */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-3">Contact & Booking</h2>
              <div className="flex flex-col gap-2">
                <a href={`tel:${data.userId?.phone || ''}`} className="btn btn-primary w-full flex items-center justify-center gap-2"><Phone className="w-4 h-4" /> Call</a>
                <button onClick={() => navigate(`/mechanics/book/${data._id}`)} className="btn btn-outline w-full flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Book Service</button>
                <button onClick={() => toast('Chat coming from request flow')} className="btn w-full flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> Ask a question</button>
              </div>
            </div>

            {/* Achievements */}
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-3">Achievements</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> Certified professional</div>
                <div className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> {data.experience} years experience</div>
                <div className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> {data.completedJobs} jobs completed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


