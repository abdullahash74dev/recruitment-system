import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ApplicationForm from "@/components/ApplicationForm/ApplicationForm";
import { LanguageProvider } from "@/contexts/LanguageContext";

const STORAGE_KEY = "akg-application-draft";

describe("ApplicationForm pre-selected job handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("overrides a saved draft position when a job is selected from the jobs page", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fullName: "Applicant Name",
        desiredPosition: "مدير الموارد البشرية",
      })
    );

    render(
      <LanguageProvider>
        <ApplicationForm preSelectedPosition="مشرف عمال" />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")).toMatchObject({
        desiredPosition: "مشرف عمال",
      });
    });
  });
});
