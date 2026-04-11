/**
 * 송출용 수송선 상태 일러스트.
 * public/game-0b/ 아래 파일명과 동일하게 두면 됨 (PNG·WebP 등 확장자만 맞추기).
 */
const SHIP_STATUS_IMAGES: Record<'ship-safe' | 'ship-danger' | 'ship-destroy', string> = {
  'ship-safe': '/game-0b/ship-status-safe.png',
  'ship-danger': '/game-0b/ship-status-danger.png',
  'ship-destroy': '/game-0b/ship-status-destroy.png',
};

export function getShipStatusImageSrc(statusClassName: string): string {
  const key = statusClassName as keyof typeof SHIP_STATUS_IMAGES;
  return SHIP_STATUS_IMAGES[key] ?? SHIP_STATUS_IMAGES['ship-safe'];
}
