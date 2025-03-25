// supabase.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nsiyjyffsvukwwmgrpkq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zaXlqeWZmc3Z1a3d3bWdycGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0NjM2MjIsImV4cCI6MjA1ODAzOTYyMn0.XUaO8TPH5WEa31ybiwd3yQCE8Z4LwBodJdDG2NcUy4A";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
