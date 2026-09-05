import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (url !== "http://127.0.0.1:54621" || process.env.ALLOWED_EMAIL !== "phase5a@example.test") {
  throw new Error("Use the isolated G5A test environment only");
}
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.ALLOWED_EMAIL });
if (error) throw error;
const user = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const result = await user.auth.verifyOtp({ type: "email", email: process.env.ALLOWED_EMAIL, token: data.properties.email_otp });
if (result.error) throw result.error;
const cookie = {
  name: "sb-127-auth-token",
  value: "base64-" + Buffer.from(JSON.stringify(result.data.session)).toString("base64url"),
  domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax", expires: -1,
};
writeFileSync("test-results/g5a.auth-state.json", JSON.stringify({ cookies: [cookie], origins: [] }), { mode: 0o600 });
console.log("Local test session saved to ignored test-results/g5a.auth-state.json");
