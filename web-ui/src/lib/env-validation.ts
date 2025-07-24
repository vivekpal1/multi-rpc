// Environment variable validation to ensure all required vars are set

const requiredEnvVars = [
  'NEXT_PUBLIC_PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'NEXT_PUBLIC_SOLANA_RPC_URL',
] as const;

const optionalEnvVars = [
  'NEXT_PUBLIC_RPC_URL',
  'RPC_ADMIN_KEY',
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
] as const;

type RequiredEnvVars = {
  [K in typeof requiredEnvVars[number]]: string;
};

type OptionalEnvVars = {
  [K in typeof optionalEnvVars[number]]?: string;
};

export type EnvVars = RequiredEnvVars & OptionalEnvVars;

class EnvValidationError extends Error {
  constructor(missingVars: string[]) {
    super(`Missing required environment variables: ${missingVars.join(', ')}`);
    this.name = 'EnvValidationError';
  }
}

export function validateEnv(): EnvVars {
  const missingVars: string[] = [];
  const env: Partial<EnvVars> = {};

  // Check required variables
  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (!value) {
      missingVars.push(varName);
    } else {
      (env as any)[varName] = value;
    }
  }

  if (missingVars.length > 0) {
    throw new EnvValidationError(missingVars);
  }

  // Add optional variables
  for (const varName of optionalEnvVars) {
    const value = process.env[varName];
    if (value) {
      (env as any)[varName] = value;
    }
  }

  // Validate Multi-RPC URL format
  if (env.NEXT_PUBLIC_RPC_URL) {
    try {
      new URL(env.NEXT_PUBLIC_RPC_URL);
    } catch {
      console.warn(`Invalid NEXT_PUBLIC_RPC_URL format: ${env.NEXT_PUBLIC_RPC_URL}`);
    }
  }

  return env as EnvVars;
}

// Run validation on module load in development
if (process.env.NODE_ENV === 'development') {
  try {
    validateEnv();
    console.log('✅ Environment variables validated successfully');
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
  }
}