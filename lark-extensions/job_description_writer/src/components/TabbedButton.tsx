import React from 'react';


interface TabButtonProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean; // Use optional chaining as good practice
  }
  
  const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick, disabled }) => {
    const baseStyle = "px-4 py-2 text-sm md:text-base font-semibold border-b-2 transition-colors duration-200 focus:outline-none";
    const activeStyle = "border-[#37A533] text-[#37A533]"; // Accent color for active tab
    const inactiveStyle = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";
    const disabledStyle = "text-gray-400 cursor-not-allowed border-transparent";
  
    const getStyle = () => {
      if (disabled) return `${baseStyle} ${disabledStyle}`;
      if (isActive) return `${baseStyle} ${activeStyle}`;
      return `${baseStyle} ${inactiveStyle}`;
    };
  
    return (
      <button
        className={getStyle()}
        onClick={onClick}
        disabled={disabled}
      >
        {label}
      </button>
    );
  };

  export default TabButton;