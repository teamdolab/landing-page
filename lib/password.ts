import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;

export function isBcryptHash(value: string): boolean {
  return BCRYPT_HASH_REGEX.test(value);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** bcrypt 우선 검증, 레거시 평문은 fallback 후 needsRehash=true 반환 */
export async function verifyPasswordWithMigration(
  plainPassword: string,
  storedPassword: string | null | undefined,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedPassword) {
    return { valid: false, needsRehash: false };
  }

  if (isBcryptHash(storedPassword)) {
    const valid = await bcrypt.compare(plainPassword, storedPassword);
    return { valid, needsRehash: false };
  }

  const bcryptValid = await bcrypt.compare(plainPassword, storedPassword);
  if (bcryptValid) {
    return { valid: true, needsRehash: false };
  }

  if (storedPassword === plainPassword) {
    return { valid: true, needsRehash: true };
  }

  return { valid: false, needsRehash: false };
}
