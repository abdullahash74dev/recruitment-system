import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { Lang } from "@/contexts/LanguageContext";
import {
  getNationalities as getDefaultNationalities,
  getSaudiCities as getDefaultCities,
  getEducationLevels as getDefaultEducation,
  getJobPositions as getDefaultPositions,
  getYearsOfExperience as getDefaultYears,
  getSalaryRanges as getDefaultSalary,
  getGenderOptions as getDefaultGender,
  getMaritalStatusOptions as getDefaultMarital,
  getYesNoOptions as getDefaultYesNo,
  getLanguageLevels as getDefaultLangLevels,
  getJobTypes as getDefaultJobTypes,
  getHearAboutOptions as getDefaultHearAbout,
  getAvailableDates as getDefaultAvailDates,
  getFacilityMgmtOptions as getDefaultFacilityMgmt,
} from "@/data/jobPositions";

interface DropdownOption {
  field_name: string;
  options_ar: string[];
  options_en: string[];
}

async function fetchAllDropdownOptionsRaw(): Promise<Record<string, DropdownOption>> {
  const { data } = await supabase
    .from("dropdown_options")
    .select("field_name, options_ar, options_en")
    .eq("is_active", true);
  const map: Record<string, DropdownOption> = {};
  (data || []).forEach((d: any) => { map[d.field_name] = d; });
  return map;
}

export const fetchAllDropdownOptions = (): Promise<Record<string, DropdownOption>> =>
  queryClient.fetchQuery({ queryKey: queryKeys.dropdownOptions.all, queryFn: fetchAllDropdownOptionsRaw });

export const invalidateDropdownCache = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.dropdownOptions.all });

export const useDropdownOptions = (lang: Lang) => {
  // Bound directly to the singleton queryClient (not context) so this shares
  // the cache with fetchAllDropdownOptions/invalidateDropdownCache even outside
  // a QueryClientProvider (e.g. in tests).
  const query = useQuery({ queryKey: queryKeys.dropdownOptions.all, queryFn: fetchAllDropdownOptionsRaw }, queryClient);
  const options = query.data ?? {};
  const loaded = query.isSuccess;

  const getOptions = (fieldName: string, fallbackAr: string[], fallbackEn: string[]): string[] => {
    const opt = options[fieldName];
    if (opt) {
      const arr = lang === "ar" ? opt.options_ar : opt.options_en;
      if (arr && arr.length > 0) return arr;
    }
    return lang === "ar" ? fallbackAr : fallbackEn;
  };

  return {
    loaded,
    getNationalities: () => getOptions("nationalities", getDefaultNationalities("ar"), getDefaultNationalities("en")),
    getCities: () => getOptions("cities", getDefaultCities("ar"), getDefaultCities("en")),
    getCurrentCities: () => getOptions("current_cities", getDefaultCities("ar"), getDefaultCities("en")),
    getPreferredCities: () => getOptions("preferred_cities", getDefaultCities("ar"), getDefaultCities("en")),
    getEducationLevels: () => getOptions("education_levels", getDefaultEducation("ar"), getDefaultEducation("en")),
    getJobPositions: () => getOptions("job_positions", getDefaultPositions("ar"), getDefaultPositions("en")),
    getYearsOfExperience: () => getOptions("years_experience", getDefaultYears("ar"), getDefaultYears("en")),
    getSalaryRanges: () => getOptions("salary_ranges", getDefaultSalary("ar"), getDefaultSalary("en")),
    getGenderOptions: () => getOptions("gender", getDefaultGender("ar"), getDefaultGender("en")),
    getMaritalStatusOptions: () => getOptions("marital_status", getDefaultMarital("ar"), getDefaultMarital("en")),
    getYesNoOptions: () => getOptions("yes_no", getDefaultYesNo("ar"), getDefaultYesNo("en")),
    getLanguageLevels: () => getOptions("language_levels", getDefaultLangLevels("ar"), getDefaultLangLevels("en")),
    getJobTypes: () => getOptions("job_types", getDefaultJobTypes("ar"), getDefaultJobTypes("en")),
    getHearAboutOptions: () => getOptions("hear_about", getDefaultHearAbout("ar"), getDefaultHearAbout("en")),
    getAvailableDates: () => getOptions("available_dates", getDefaultAvailDates("ar"), getDefaultAvailDates("en")),
    getFacilityMgmtOptions: () => getOptions("facility_mgmt", getDefaultFacilityMgmt("ar"), getDefaultFacilityMgmt("en")),
    getCustomOptions: (fieldName: string, fallbackAr: string[], fallbackEn: string[]) =>
      getOptions(fieldName, fallbackAr, fallbackEn),
  };
};
