import { ICON_TOKENS, DynamicIcon } from './utils';
import { cn } from '@/lib/utils';

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 mt-1.5 max-h-[200px] overflow-y-auto p-1 border rounded-md bg-background/50">
      {ICON_TOKENS.map((token) => {
        const isSelected = value === token;
        
        return (
          <button
            key={token}
            type="button"
            disabled={disabled}
            onClick={() => onChange(token)}
            className={cn(
              "p-2 rounded-md border transition-all flex items-center justify-center hover:bg-accent",
              isSelected 
                ? "bg-gold/20 border-gold text-gold scale-105 shadow-sm" 
                : "bg-background border-transparent text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            title={token}
          >
            <DynamicIcon token={token} className="w-5 h-5" />
          </button>
        );
      })}
    </div>
  );
}
