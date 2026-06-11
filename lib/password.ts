/** 임시 평문 저장/비교 (향후 bcrypt 재구현 예정) */

export async function hashPassword(password: string): Promise<string> {
  return password;
}

export async function verifyPasswordWithMigration(
  plainPassword: string,
  storedPassword: string | null | undefined,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedPassword) {
    return { valid: false, needsRehash: false };
  }
  return { valid: storedPassword === plainPassword, needsRehash: false };
}
