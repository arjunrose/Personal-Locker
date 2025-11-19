import React from 'react';
import { Delete } from 'lucide-react';

interface KeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

const Keypad: React.FC<KeypadProps> = ({ onKeyPress, onDelete, disabled = false }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'];

  return (
    <div className="grid grid-cols-3 gap-6 max-w-[280px] mx-auto mt-8">
      {keys.map((k, i) => {
        if (k === '') return <div key={`empty-${i}`}></div>;
        
        if (k === 'DEL') {
          return (
            <button
              key="del"
              onClick={onDelete}
              disabled={disabled}
              className="flex items-center justify-center w-16 h-16 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors text-white focus:outline-none disabled:opacity-50"
              aria-label="Delete"
            >
              <Delete size={24} />
            </button>
          );
        }

        return (
          <button
            key={k}
            onClick={() => onKeyPress(k)}
            disabled={disabled}
            className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-2xl font-light text-white hover:bg-white/20 active:scale-95 transition-all duration-150 focus:outline-none disabled:opacity-50 flex items-center justify-center"
          >
            {k}
          </button>
        );
      })}
    </div>
  );
};

export default Keypad;