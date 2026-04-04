/**
 * 밤 액션 일괄 처리 엔진
 * advance-phase의 start_round 내부에서 호출됨.
 * 해당 라운드의 모든 night_action 이벤트를 우선순위대로 처리하여
 * game_0b 스냅샷에 반영할 변경 사항을 반환한다.
 */
import { playerCoreKey, playerRoleKey } from './game-0b-types';

export type NightEvent = {
  id: number;
  actor_player_number: number;
  event_data: {
    action_type: string;
    round: number;
    cost: number;
    target_player?: number;
    extra?: Record<string, unknown>;
    is_non_consuming?: boolean;
    [key: string]: unknown;
  };
};

export type GameSnapshot = Record<string, unknown>;

export type ResolveResult = {
  updates: Record<string, unknown>;
  detectedActions: unknown[];
  log: string[];
};

export function resolveNightActions(
  game: GameSnapshot,
  events: NightEvent[],
): ResolveResult {
  const updates: Record<string, unknown> = {};
  const log: string[] = [];
  let detectedActions: unknown[] = [];

  const controlledPlayers = new Set<number>();
  let jammingActive = false;
  let commanderAssassinated = false;
  let revolutionaryAssassinated = false;

  const detectTargets: number[] = [];
  let detectActor: number | null = null;

  const grouped = {
    control: [] as NightEvent[],
    general: [] as NightEvent[],
    assassinate: [] as NightEvent[],
    plunder: [] as NightEvent[],
    detect: [] as NightEvent[],
  };

  for (const ev of events) {
    const action = ev.event_data.action_type;
    if (action === 'control') grouped.control.push(ev);
    else if (action === 'assassinate') grouped.assassinate.push(ev);
    else if (action === 'plunder') grouped.plunder.push(ev);
    else if (action === 'detect') grouped.detect.push(ev);
    else grouped.general.push(ev);
  }

  const getCore = (p: number): number => {
    const key = playerCoreKey(p);
    return (updates[key] as number | undefined) ?? (game[key] as number) ?? 0;
  };
  const setCore = (p: number, val: number) => {
    updates[playerCoreKey(p)] = val;
  };

  const getRole = (p: number): string | null => {
    const key = playerRoleKey(p);
    return (updates[key] as string | undefined) ?? (game[key] as string | null) ?? null;
  };
  const setRole = (p: number, role: string | null) => {
    updates[playerRoleKey(p)] = role;
  };

  // === 1순위: 통제 ===
  for (const ev of grouped.control) {
    const target = ev.event_data.target_player;
    if (target != null) {
      controlledPlayers.add(target);
      log.push(`[통제] ${ev.actor_player_number}번 → ${target}번 통제`);
    }
  }

  // === 2순위: 일반 (채굴/수리/탐색/교란/은닉거래/파괴) ===
  for (const ev of grouped.general) {
    const actor = ev.actor_player_number;
    const action = ev.event_data.action_type;

    if (controlledPlayers.has(actor) && action !== 'hidden_trade') {
      log.push(`[통제됨] ${actor}번의 ${action} 무효화`);
      continue;
    }

    switch (action) {
      case 'mine': {
        setCore(actor, getCore(actor) + 2);
        log.push(`[채굴] ${actor}번 → 코어 +2`);
        break;
      }
      case 'repair_survivor':
      case 'repair_rebel':
      case 'repair': {
        const hull = (updates.ship_hull as number | undefined) ?? (game.ship_hull as number);
        updates.ship_hull = hull + 10;
        log.push(`[수리] ${actor}번 → 게이지 +10%`);
        break;
      }
      case 'search': {
        const target = ev.event_data.target_player;
        if (target != null) {
          const targetRole = getRole(target);
          let faction = '불명';
          if (targetRole === '사령관' || targetRole === '생존자') faction = '생존자 진영';
          else if (targetRole === '반군수장' || targetRole === '혁명가' || targetRole === '반군') faction = '반군 진영';
          else if (targetRole === '외계인') faction = '외계인 진영';

          ev.event_data.search_result = faction;
          log.push(`[탐색] ${actor}번 → ${target}번 = ${faction}`);
        }
        break;
      }
      case 'jamming': {
        jammingActive = true;
        log.push(`[교란] ${actor}번 → 감지 무효화`);
        break;
      }
      case 'destroy': {
        const hull = (updates.ship_hull as number | undefined) ?? (game.ship_hull as number);
        updates.ship_hull = hull - 20;
        log.push(`[파괴] ${actor}번 → 게이지 -20%`);
        break;
      }
      case 'hidden_trade': {
        // 코어 이동은 night-action API에서 이미 처리됨
        log.push(`[은닉거래] ${actor}번 → ${ev.event_data.target_player}번`);
        break;
      }
      case 'skip': {
        log.push(`[스킵] ${actor}번 → 행동 없음`);
        break;
      }
    }
  }

  // === 3순위: 암살 ===
  for (const ev of grouped.assassinate) {
    const actor = ev.actor_player_number;
    const target = ev.event_data.target_player;

    if (controlledPlayers.has(actor)) {
      log.push(`[통제됨] ${actor}번의 암살 무효화`);
      continue;
    }

    if (target == null) continue;

    if (game.current_round === 1) {
      log.push(`[암살] ${actor}번 → 1라운드에는 암살 불가`);
      continue;
    }

    const actorRole = getRole(actor);
    const targetRole = getRole(target);
    const commanderNum = (updates.commander_player_number as number | undefined) ?? (game.commander_player_number as number | null);
    const revolutionaryNum = (updates.revolutionary_player_number as number | undefined) ?? (game.revolutionary_player_number as number | null);

    if (actorRole === '반군수장' || actorRole === '반군') {
      if (target === commanderNum && targetRole === '사령관') {
        // 사령관 암살 성공 → 혁명
        setRole(target, '생존자');
        updates.former_commander_player_number = commanderNum;
        updates.commander_player_number = null;
        commanderAssassinated = true;

        // 반군수장을 찾아서 혁명가로 변환 (암살자가 반군수장이든 반군이든 관계없이)
        const pc = (game.player_count as number) ?? 12;
        let rebelLeaderNum: number | null = null;
        if (actorRole === '반군수장') {
          rebelLeaderNum = actor;
        } else {
          for (let i = 1; i <= pc; i++) {
            if (getRole(i) === '반군수장') {
              rebelLeaderNum = i;
              break;
            }
          }
        }

        if (rebelLeaderNum != null) {
          setRole(rebelLeaderNum, '혁명가');
          updates.revolutionary_player_number = rebelLeaderNum;

          // 자금 찬탈: 사령관의 코어를 혁명가(반군수장)에게
          const commanderCore = getCore(target);
          setCore(rebelLeaderNum, getCore(rebelLeaderNum) + commanderCore);
          setCore(target, 0);
          log.push(`[암살 성공] ${actor}번 → ${target}번(사령관) 암살 → ${rebelLeaderNum}번 혁명가 변환 + 코어 ${commanderCore}개 찬탈`);
        } else {
          log.push(`[암살 성공] ${actor}번 → ${target}번(사령관) 암살 (반군수장 없음)`);
        }
      } else {
        log.push(`[암살 실패] ${actor}번 → ${target}번 (사령관이 아님)`);
      }
    } else if (actorRole === '생존자') {
      if (target === revolutionaryNum && targetRole === '혁명가') {
        // 혁명가 암살 성공 → 사령관 재탈환
        setRole(target, '반군수장');
        updates.revolutionary_player_number = null;
        setRole(actor, '사령관');
        updates.commander_player_number = actor;
        revolutionaryAssassinated = true;
        log.push(`[암살 성공] ${actor}번(생존자) → ${target}번(혁명가) 암살 + 사령관 탈환`);
      } else {
        log.push(`[암살 실패] ${actor}번(생존자) → ${target}번 (혁명가가 아님)`);
      }
    } else {
      log.push(`[암살 실패] ${actor}번 → 암살 권한 없음`);
    }
  }

  // === 4순위: 약탈 (최종 잔고 기준) ===
  for (const ev of grouped.plunder) {
    const actor = ev.actor_player_number;
    const target = ev.event_data.target_player;

    if (controlledPlayers.has(actor)) {
      log.push(`[통제됨] ${actor}번의 약탈 무효화`);
      continue;
    }

    if (target == null) continue;

    const targetCore = getCore(target);
    const stolen = Math.min(3, targetCore);
    if (stolen > 0) {
      setCore(target, targetCore - stolen);
      setCore(actor, getCore(actor) + stolen);
    }
    log.push(`[약탈] ${actor}번 → ${target}번에서 코어 ${stolen}개 약탈`);
  }

  // === 5순위: 감지 ===
  for (const ev of grouped.detect) {
    const actor = ev.actor_player_number;

    if (controlledPlayers.has(actor)) {
      log.push(`[통제됨] ${actor}번의 감지 무효화`);
      continue;
    }

    detectActor = actor;
    const targets = ev.event_data.extra?.targets as number[] | undefined;
    if (targets) {
      detectTargets.push(...targets);
    } else if (ev.event_data.target_player != null) {
      detectTargets.push(ev.event_data.target_player);
    }
  }

  if (commanderAssassinated) {
    detectedActions = [
      { action: 'commander_assassinated', target: null },
      { action: 'revolutionary_emerged', target: null },
    ];
    log.push(`[감지 무효] 사령관 암살로 감지 무효화`);
  } else if (revolutionaryAssassinated) {
    detectedActions = [
      { action: 'revolutionary_assassinated', target: null },
      { action: 'commander_reclaimed', target: null },
    ];
    log.push(`[혁명가 암살] 사령관 재집권`);
  } else if (detectActor != null && detectTargets.length > 0 && !jammingActive) {
    const actionSummaries: unknown[] = [];
    for (const t of detectTargets) {
      const targetActions = events.filter(
        (e) => e.actor_player_number === t && e.event_data.action_type !== 'detect',
      );
      for (const ta of targetActions) {
        actionSummaries.push({
          action: ta.event_data.action_type,
          target: ta.event_data.target_player ?? null,
        });
      }
      if (targetActions.length === 0) {
        actionSummaries.push({ action: 'none', target: null });
      }
    }
    detectedActions = shuffle(actionSummaries);
    log.push(`[감지] ${detectActor}번 → ${detectTargets.join(',')}번 감지 (${actionSummaries.length}건)`);
  } else if (detectActor != null && jammingActive) {
    log.push(`[감지 무효] 교란으로 감지 무효화됨`);
  }

  return { updates, detectedActions, log };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
