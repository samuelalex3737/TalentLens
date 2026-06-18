import { createClient } from '@supabase/supabase-js';

// Supabase project credentials
const supabaseUrl = 'https://amwllhxmsktgzhtqsplb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtd2xsaHhtc2t0Z3podHFzcGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTAzOTEsImV4cCI6MjA5NzEyNjM5MX0.XUlwt6Eu8nVqQMyWRnRW5NPKiwcfhV2gJVJPzft-PRI';

export const supabase = createClient(supabaseUrl, supabaseKey);
