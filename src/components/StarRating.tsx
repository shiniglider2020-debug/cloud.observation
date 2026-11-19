import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (next: number) => void;
  size?: 'sm' | 'md';
  showNumeric?: boolean;
}

export function StarRating({
  value,
  onChange,
  size = 'sm',
  showNumeric = true,
}: StarRatingProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="inline-flex items-center gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label={`Rating ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const filled = starIndex <= value;
          if (onChange) {
            return (
              <button
                key={starIndex}
                type="button"
                onClick={() => onChange(starIndex === value ? 0 : starIndex)}
                aria-label={`Set rating to ${starIndex} of 5`}
                className="p-0.5 text-slate-300 transition-colors hover:text-amber-500 focus-visible:outline-2 focus-visible:outline-sky-600"
              >
                <Star
                  className={`${iconSize} ${
                    filled ? 'fill-slate-800 text-slate-800' : 'text-slate-300'
                  }`}
                />
              </button>
            );
          }
          return (
            <Star
              key={starIndex}
              aria-hidden="true"
              className={`${iconSize} ${
                filled ? 'fill-slate-800 text-slate-800' : 'text-slate-300'
              }`}
            />
          );
        })}
      </div>
      {showNumeric && (
        <span className="font-mono text-xs font-medium text-slate-700 tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
}
