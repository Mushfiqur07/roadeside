import React from 'react';
import { Wrench, AlertTriangle } from 'lucide-react';

const MechanicMaintenancePage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-xl w-full text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mx-auto mb-4">
          <Wrench className="w-8 h-8 text-yellow-700" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Maintenance in Progress</h1>
        <p className="text-gray-600 mb-6">Mechanic functions are temporarily unavailable while we perform maintenance.</p>
        <div className="rounded-lg bg-yellow-50 text-yellow-800 p-3 text-sm flex items-start space-x-2">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <span>Real-time jobs and updates will resume automatically when maintenance ends.</span>
        </div>
      </div>
    </div>
  );
};

export default MechanicMaintenancePage;


