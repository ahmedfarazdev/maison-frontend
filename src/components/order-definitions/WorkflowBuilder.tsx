import { StatusesPipeline } from './StatusesPipeline';
import { TransitionsPanel } from './TransitionsPanel';
import type { DraftStatus, DraftTransition } from './types';

interface WorkflowBuilderProps {
  statuses: DraftStatus[];
  transitions: DraftTransition[];
  onStatusesChange: (statuses: DraftStatus[]) => void;
  onTransitionsChange: (transitions: DraftTransition[]) => void;
  disabled?: boolean;
}

const normalizeStatusCode = (value: string): string => value.trim();

const getStatusIdentity = (status: DraftStatus, index: number): string =>
  status.id ?? status.clientTempId ?? `status-${index}`;

const transitionsEqual = (a: DraftTransition[], b: DraftTransition[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((left, index) => {
    const right = b[index];
    return (
      left.id === right.id
      && left.fromStatusCode === right.fromStatusCode
      && left.toStatusCode === right.toStatusCode
      && left.condition === right.condition
      && left.active === right.active
    );
  });
};

const isOrderOrMembershipChanged = (
  previousStatuses: DraftStatus[],
  nextStatuses: DraftStatus[],
): boolean => {
  if (previousStatuses.length !== nextStatuses.length) {
    return true;
  }

  for (let i = 0; i < previousStatuses.length; i += 1) {
    const prevIdentity = getStatusIdentity(previousStatuses[i], i);
    const nextIdentity = getStatusIdentity(nextStatuses[i], i);
    if (prevIdentity !== nextIdentity) {
      return true;
    }
  }

  return false;
};

const remapTransitionsForRenamedCodes = (
  previousStatuses: DraftStatus[],
  nextStatuses: DraftStatus[],
  currentTransitions: DraftTransition[],
): DraftTransition[] => {
  const previousCodeByIdentity = new Map<string, string>();
  previousStatuses.forEach((status, index) => {
    previousCodeByIdentity.set(
      getStatusIdentity(status, index),
      normalizeStatusCode(status.statusCode),
    );
  });

  const nextCodeByIdentity = new Map<string, string>();
  nextStatuses.forEach((status, index) => {
    nextCodeByIdentity.set(
      getStatusIdentity(status, index),
      normalizeStatusCode(status.statusCode),
    );
  });

  const renamedCodeMap = new Map<string, string>();
  previousCodeByIdentity.forEach((previousCode, identity) => {
    const nextCode = nextCodeByIdentity.get(identity);
    if (previousCode && nextCode && previousCode !== nextCode) {
      renamedCodeMap.set(previousCode, nextCode);
    }
  });

  return currentTransitions.map((transition) => {
    const oldFrom = normalizeStatusCode(transition.fromStatusCode);
    const oldTo = normalizeStatusCode(transition.toStatusCode);
    return {
      ...transition,
      fromStatusCode: renamedCodeMap.get(oldFrom) ?? oldFrom,
      toStatusCode: renamedCodeMap.get(oldTo) ?? oldTo,
    };
  });
};

const buildLinkedTransitions = (
  nextStatuses: DraftStatus[],
  currentTransitions: DraftTransition[],
): DraftTransition[] => {
  const orderedCodes = nextStatuses
    .map((status) => normalizeStatusCode(status.statusCode))
    .filter((code) => Boolean(code));

  const byPair = new Map<string, DraftTransition>();
  currentTransitions.forEach((transition) => {
    const from = normalizeStatusCode(transition.fromStatusCode);
    const to = normalizeStatusCode(transition.toStatusCode);
    if (!from || !to) {
      return;
    }
    byPair.set(`${from}|${to}`, transition);
  });

  const linked: DraftTransition[] = [];
  for (let i = 0; i < orderedCodes.length - 1; i += 1) {
    const from = orderedCodes[i];
    const to = orderedCodes[i + 1];
    const existing = byPair.get(`${from}|${to}`);

    linked.push({
      id: existing?.id,
      fromStatusCode: from,
      toStatusCode: to,
      condition: existing?.condition ?? '',
      active: existing?.active ?? true,
    });
  }

  return linked;
};

const reevaluateTransitions = (
  previousStatuses: DraftStatus[],
  nextStatuses: DraftStatus[],
  currentTransitions: DraftTransition[],
): DraftTransition[] => {
  const remappedTransitions = remapTransitionsForRenamedCodes(
    previousStatuses,
    nextStatuses,
    currentTransitions,
  );

  if (isOrderOrMembershipChanged(previousStatuses, nextStatuses)) {
    return buildLinkedTransitions(nextStatuses, remappedTransitions);
  }

  const nextStatusOrder = new Map<string, number>();
  nextStatuses.forEach((status, index) => {
    const code = normalizeStatusCode(status.statusCode);
    if (code) {
      nextStatusOrder.set(code, index);
    }
  });

  const dedupe = new Set<string>();
  const reconciled: DraftTransition[] = [];

  remappedTransitions.forEach((transition) => {
    const from = normalizeStatusCode(transition.fromStatusCode);
    const to = normalizeStatusCode(transition.toStatusCode);

    if (!nextStatusOrder.has(from) || !nextStatusOrder.has(to)) {
      return;
    }

    const dedupeKey = [from, to, transition.condition.trim(), transition.active ? '1' : '0'].join('|');
    if (dedupe.has(dedupeKey)) {
      return;
    }

    dedupe.add(dedupeKey);
    reconciled.push({
      ...transition,
      fromStatusCode: from,
      toStatusCode: to,
    });
  });

  reconciled.sort((left, right) => {
    const leftFrom = nextStatusOrder.get(normalizeStatusCode(left.fromStatusCode)) ?? Number.MAX_SAFE_INTEGER;
    const rightFrom = nextStatusOrder.get(normalizeStatusCode(right.fromStatusCode)) ?? Number.MAX_SAFE_INTEGER;
    if (leftFrom !== rightFrom) {
      return leftFrom - rightFrom;
    }

    const leftTo = nextStatusOrder.get(normalizeStatusCode(left.toStatusCode)) ?? Number.MAX_SAFE_INTEGER;
    const rightTo = nextStatusOrder.get(normalizeStatusCode(right.toStatusCode)) ?? Number.MAX_SAFE_INTEGER;
    return leftTo - rightTo;
  });

  return reconciled;
};

export function WorkflowBuilder({
  statuses,
  transitions,
  onStatusesChange,
  onTransitionsChange,
  disabled,
}: WorkflowBuilderProps) {
  const createTempId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const handleStatusesChange = (nextStatuses: DraftStatus[]) => {
    const nextTransitions = reevaluateTransitions(statuses, nextStatuses, transitions);

    if (!transitionsEqual(transitions, nextTransitions)) {
      onTransitionsChange(nextTransitions);
    }

    onStatusesChange(nextStatuses);
  };

  const handleAddStatus = () => {
    const newStatus: DraftStatus = {
      clientTempId: createTempId(),
      statusCode: '',
      label: '',
      colorToken: 'blue',
      isTerminal: false,
      active: true,
    };
    handleStatusesChange([...statuses, newStatus]);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Status Pipeline
        </p>
        <StatusesPipeline
          statuses={statuses}
          onStatusesChange={handleStatusesChange}
          onAddStatus={handleAddStatus}
          disabled={disabled}
        />
        <p className="text-[10px] text-muted-foreground">
          Drag to reorder statuses in the workflow pipeline.
        </p>
      </div>

      <div className="space-y-2">
        <TransitionsPanel
          transitions={transitions}
          statuses={statuses}
          onTransitionsChange={onTransitionsChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}