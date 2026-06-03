// RC4-C language contract.
// Supported operator UI languages only: ru and en.
// Ukrainian fallback and browser auto-language are intentionally forbidden.
export const dictionary = {
  ru: {
    panels: {
      revisionTimeline: { title: 'Линия ревизий' },
      replay: { title: 'Панель повтора' },
      liveStream: { title: 'Живой поток' },
      coreOverview: { title: 'Пульт ядра' }
    },
    fields: {},
    statuses: {
      verified: 'подтверждено',
      current: 'текущая',
      disconnected: 'отключён',
      prohibited: 'запрещено',
      closed: 'закрыта',
      missing: 'отсутствует',
      unknown: 'неизвестно'
    },
    actions: {
      resetLayout: 'Сбросить раскладку'
    },
    messages: {
      noProofNoAllow: 'Нет доказательств → нет разрешения'
    },
    settings: {
      compactMode: 'Компактный режим',
      hotkeys: 'Горячие клавиши'
    }
  },
  en: {
    panels: {
      revisionTimeline: { title: 'Revision Timeline' },
      replay: { title: 'Replay Panel' },
      liveStream: { title: 'Live Market Stream' },
      coreOverview: { title: 'Core Overview' }
    },
    fields: {},
    statuses: {
      verified: 'verified',
      current: 'current',
      disconnected: 'disconnected',
      prohibited: 'prohibited',
      closed: 'closed',
      missing: 'missing',
      unknown: 'unknown'
    },
    actions: {
      resetLayout: 'Reset layout'
    },
    messages: {
      noProofNoAllow: 'NO PROOF → NO ALLOW'
    },
    settings: {
      compactMode: 'Compact mode',
      hotkeys: 'Hotkeys'
    }
  }
} as const;
