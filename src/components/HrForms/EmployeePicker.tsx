// Searchable employee selector used by the fill screen: picking an employee
// is what triggers auto-fill of every source="employee" field.

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useEmployeesQuery } from "@/hooks/queries/useHrForms";
import type { Employee } from "@/lib/hrForms/types";

interface Props {
  value: string | null;
  onChange: (employee: Employee | null) => void;
  lang: "en" | "ar";
}

const EmployeePicker = ({ value, onChange, lang }: Props) => {
  const { data: employees = [] } = useEmployeesQuery();
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => employees.find((e) => e.id === value) ?? null, [employees, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          <span className="flex items-center gap-2 truncate">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selected
              ? `${selected.full_name_en}${selected.employee_no ? ` (${selected.employee_no})` : ""}`
              : lang === "ar" ? "اختر موظفًا..." : "Select an employee..."}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={lang === "ar" ? "ابحث بالاسم أو الرقم الوظيفي" : "Search by name or ID"} />
          <CommandList>
            <CommandEmpty>{lang === "ar" ? "لا توجد نتائج" : "No employees found"}</CommandEmpty>
            <CommandGroup>
              {employees.map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={`${emp.full_name_en} ${emp.full_name_ar ?? ""} ${emp.employee_no ?? ""}`}
                  onSelect={() => {
                    onChange(emp.id === value ? null : emp);
                    setOpen(false);
                  }}
                >
                  <Check className={`me-2 h-4 w-4 ${emp.id === value ? "opacity-100" : "opacity-0"}`} />
                  <div className="min-w-0">
                    <div className="truncate">{emp.full_name_en}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[emp.employee_no, emp.department, emp.job_title].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default EmployeePicker;
