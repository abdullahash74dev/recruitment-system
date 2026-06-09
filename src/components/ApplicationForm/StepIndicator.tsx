import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

const StepIndicator = ({ currentStep, totalSteps, stepLabels }: StepIndicatorProps) => {
  return (
    <div className="w-full mb-8">
      {/* Mobile: horizontal scroll with compact circles */}
      <div className="flex items-start justify-between relative overflow-x-auto pb-2 gap-1 sm:gap-0">
        {/* Progress line */}
        <div className="absolute top-5 right-5 left-5 h-0.5 bg-border hidden sm:block">
          <div
            className="h-full gradient-accent transition-all duration-500 ease-out"
            style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>

        {stepLabels.map((label, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div key={stepNum} className="flex flex-col items-center relative z-10 min-w-[3rem] sm:min-w-0 flex-1 sm:flex-initial">
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-300 shrink-0 ${
                  isCompleted
                    ? "gradient-accent text-accent-foreground"
                    : isCurrent
                    ? "bg-primary text-primary-foreground ring-2 sm:ring-4 ring-accent/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : stepNum}
              </div>
              <span
                className={`mt-1.5 text-[10px] sm:text-xs font-medium text-center leading-tight line-clamp-2 max-w-[3.5rem] sm:max-w-[80px] ${
                  isCurrent ? "text-primary" : isCompleted ? "text-accent" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
