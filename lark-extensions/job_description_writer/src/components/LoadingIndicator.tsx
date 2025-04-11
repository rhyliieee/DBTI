import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ 
  message = 'Loading...'
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin mb-4" style={{ borderTopColor: '#37A533' }}></div>
      <p className="text-center font-quicksand text-gray-700">{message}</p>
    </div>
  );
};

export default LoadingIndicator;