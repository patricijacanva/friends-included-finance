function requiredServerEnvironment(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SECRET_KEY"): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseServerEnvironment() {
  return {
    url: requiredServerEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    secretKey: requiredServerEnvironment("SUPABASE_SECRET_KEY"),
  };
}
