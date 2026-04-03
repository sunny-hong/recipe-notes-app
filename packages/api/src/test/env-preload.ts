// Loads .env.test before any module that validates environment variables.
// Uses import.meta.dir (absolute) so this works regardless of cwd.
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(import.meta.dir, "../../.env.test") });
