import "server-only";
import { fetchCareerSource } from "@/lib/integrations/career/fetch";
import { extractCareerRequirements } from "@/lib/career/extraction";

// The repository boundary is the only career-worker entry into external services.
export const fetchOfficialCareerSourceForJob = fetchCareerSource;
export const extractCareerRequirementsForJob = extractCareerRequirements;
