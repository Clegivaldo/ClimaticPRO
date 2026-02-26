import React from 'react';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, onBack, rightAction, transparent }) => {
  return (
    <header className={`px-4 py-3 flex items-center justify-between z-20 sticky top-0 ${transparent ? 'bg-transparent' : 'bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800'}`}>
      <div className="w-10">
        {onBack && (
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-primary flex items-center">
            <span className="material-icons-round text-2xl">chevron_left</span>
          </button>
        )}
      </div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-[200px] text-center">{title}</h1>
      <div className="w-10 flex justify-end">
        {rightAction}
      </div>
    </header>
  );
};
