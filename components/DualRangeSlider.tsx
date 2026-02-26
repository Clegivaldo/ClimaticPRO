import React, { useState, useRef, useEffect } from 'react';

interface DualRangeSliderProps {
  min: number;
  max: number;
  initialMin: number;
  initialMax: number;
  unit: string;
  onChange: (min: number, max: number) => void;
}

export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({ min, max, initialMin, initialMax, unit, onChange }) => {
  const [minVal, setMinVal] = useState(initialMin);
  const [maxVal, setMaxVal] = useState(initialMax);
  const minValRef = useRef(initialMin);
  const maxValRef = useRef(initialMax);
  const range = useRef<HTMLDivElement>(null);

  // Convert to percentage
  const getPercent = (value: number) => Math.round(((value - min) / (max - min)) * 100);

  useEffect(() => {
    const minPercent = getPercent(minVal);
    const maxPercent = getPercent(maxValRef.current);

    if (range.current) {
      range.current.style.left = `${minPercent}%`;
      range.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minVal, getPercent]);

  useEffect(() => {
    const minPercent = getPercent(minValRef.current);
    const maxPercent = getPercent(maxVal);

    if (range.current) {
      range.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [maxVal, getPercent]);

  return (
    <div className="pt-6 pb-6 px-2 relative w-full">
      <div className="relative w-full h-1.5 bg-gray-700 rounded-full">
        <div 
            ref={range}
            className="absolute h-full bg-primary rounded-full z-10"
        ></div>
        
        {/* Thumb Left */}
        <input
            type="range"
            min={min}
            max={max}
            value={minVal}
            onChange={(event) => {
              const value = Math.min(Number(event.target.value), maxVal - 1);
              setMinVal(value);
              minValRef.current = value;
              onChange(value, maxVal);
            }}
            className="absolute w-full -top-1.5 h-1.5 z-20 opacity-0 cursor-pointer pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6"
            style={{ zIndex: minVal > max - 100 ? 5 : undefined}}
        />
        <div 
            className="absolute w-5 h-5 bg-white border-2 border-primary rounded-full -top-[7px] z-20 shadow cursor-grab active:scale-110 transition-transform"
            style={{ left: `calc(${getPercent(minVal)}% - 10px)` }}
        >
             <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded opacity-100 transition-opacity whitespace-nowrap">
                {minVal}{unit}
             </div>
        </div>

        {/* Thumb Right */}
        <input
            type="range"
            min={min}
            max={max}
            value={maxVal}
            onChange={(event) => {
              const value = Math.max(Number(event.target.value), minVal + 1);
              setMaxVal(value);
              maxValRef.current = value;
              onChange(minVal, value);
            }}
            className="absolute w-full -top-1.5 h-1.5 z-20 opacity-0 cursor-pointer pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6"
        />
        <div 
            className="absolute w-5 h-5 bg-white border-2 border-primary rounded-full -top-[7px] z-20 shadow cursor-grab active:scale-110 transition-transform"
            style={{ left: `calc(${getPercent(maxVal)}% - 10px)` }}
        >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded opacity-100 transition-opacity whitespace-nowrap">
                {maxVal}{unit}
            </div>
        </div>

      </div>
      
      <div className="flex justify-between mt-4 text-[10px] text-gray-400 font-medium">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};
