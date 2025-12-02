import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { maintenanceAPI } from '../../api';

const MaintenancePage = () => {
  const [maintenance, setMaintenance] = useState(true);

  useEffect(() => {
    let mounted = true;
    maintenanceAPI.status().then((d)=>{
      if (mounted) setMaintenance(!!d.maintenance);
    }).catch(()=>{});
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-xl w-full text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-yellow-700" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Scheduled Maintenance</h1>
        <p className="text-gray-600 mb-6">We are performing scheduled maintenance to improve your experience. Thank you for your patience.</p>
        {maintenance ? (
          <div className="rounded-lg bg-yellow-50 text-yellow-800 p-3 text-sm">Service is temporarily unavailable for regular users and mechanics.</div>
        ) : (
          <div className="rounded-lg bg-emerald-50 text-emerald-800 p-3 text-sm">Maintenance completed. You can continue using the app.</div>
        )}
      </div>
    </div>
  );
};

export default MaintenancePage;


