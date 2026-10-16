import { cn } from "@/lib/utils";
import { RiLoaderLine } from "@remixicon/react";
import type { ComponentProps } from "react";

type SpinnerProps = Omit<ComponentProps<typeof RiLoaderLine>, "children"> & {
  className?: string;
};

function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <RiLoaderLine
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };