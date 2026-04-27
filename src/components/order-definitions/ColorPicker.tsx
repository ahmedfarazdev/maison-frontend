import { COLOR_TOKEN_STYLES } from './utils';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {Object.keys(COLOR_TOKEN_STYLES).map((token) => {
        const styleClasses = COLOR_TOKEN_STYLES[token];
        const isSelected = value === token;

        // Extract background color class from the token style
        // e.g. "bg-yellow-500/10 border-yellow-500/30 text-yellow-300" -> "bg-yellow-500"
        const bgBase = styleClasses.split(' ')[0].split('/')[0];
        
        return (
          <button
            key={token}
            type="button"
            disabled={disabled}
            onClick={() => onChange(token)}
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center",
              bgBase,
              isSelected ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            title={token.charAt(0).toUpperCase() + token.slice(1)}
          >
            {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
          </button>
        );
      })}
    </div>
  );
}
