import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    onValueChange?: (value: string) => void;
  }
>(({ className, children, onValueChange, ...props }, ref) => {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white ring-offset-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      onChange={(e) => {
        onValueChange?.(e.target.value);
        props.onChange?.(e);
      }}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

const SelectTrigger = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white ring-offset-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none text-gray-400" />
  </div>
));
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, ...props }, ref) => (
  <option
    className={cn("text-sm text-white bg-gray-800", className)}
    ref={ref}
    {...props}
  />
));
SelectValue.displayName = "SelectValue";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn("bg-gray-800 border border-gray-600 rounded-md", className)}
    ref={ref}
    {...props}
  />
));
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, ...props }, ref) => (
  <option
    className={cn("text-sm text-white bg-gray-800 hover:bg-gray-700", className)}
    ref={ref}
    {...props}
  />
));
SelectItem.displayName = "SelectItem";

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
}; 