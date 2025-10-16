export interface Translations {
  common: {
    loading: string
    error: string
    success: string
    retry: string
    close: string
    save: string
    cancel: string
    delete: string
    edit: string
    create: string
    back: string
    next: string
    yes: string
    no: string
    ok: string
    today: string
    tomorrow: string
    yesterday: string
    seeAll: string
  }
  auth: {
    email: string
    emailPlaceholder: string
    sendMagicLink: string
    sendingMagicLink: string
    magicLinkDescription: string
    checkYourEmail: string
    emailSentTo: string
    emailSentDescription: string
    verificationCode: string
    verificationCodePlaceholder: string
    paste: string
    openEmail: string
    goBack: string
    noAccount: string
    createAccount: string
    digitsRemaining: string
    errors: {
      invalidEmail: string
      emailNotProvided: string
      somethingWentWrong: string
      couldNotOpenEmail: string
      invalidCodeInClipboard: string
      couldNotAccessClipboard: string
      invalidCode: string
      verificationError: string
    }
  }
  dashboard: {
    greeting: {
      morning: string
      afternoon: string
      evening: string
      night: string
    }
    subtitle: string
    loadingDashboard: string
  }
  reminders: {
    title: string
    subtitle: string
    loading: string
    empty: string
    createSuccess: string
    createError: string
    status: {
      pending: string
      sent: string
      completed: string
      failed: string
      unknown: string
    }
    sampleTasks: {
      putWaterForMate: string
      takeMedicine: string
    }
    create: {
      title: string
      cancel: string
      save: string
      forLabel: string
      taskLabel: string
      taskPlaceholder: string
      dateLabel: string
      dateFormat: string
      timeLabel: string
      timeFormat: string
      frequencyLabel: string
      frequencies: {
        once: string
        daily: string
        weekly: string
      }
      errors: {
        taskRequired: string
        dateTimeRequired: string
      }
    }
  }
  settings: {
    title: string
    language: string
    languages: {
      spanish: string
      english: string
    }
  }
  contacts: {
    title: string
  }
  navigation: {
    home: string
    explore: string
    dashboard: string
    contacts: string
    settings: string
    profile: string
  }
  errors: {
    unexpected: string
    network: string
    unauthorized: string
  }
  createAccount: {
    title: string
    subtitle: string
    whatsappMessage: string
    smsMessage: string
    emailSubject: string
    emailBody: string
    whatsappError: string
    whatsappNotInstalled: string
    smsError: string
    emailError: string
  }
  assistant: {
    defaultUserName: string
    header: string
    placeholder: string
    emptyStateTitle: string
    emptyStateSubtitle: string
    listening: string
    speaking: string
    processing: string
    startListening: string
    stopListening: string
    tapToStopRecording: string
    tapToStopSpeaking: string
    tapToSpeak: string
    tapToEndConversation: string
    waitingForYou: string
    errors: {
      noPermission: string
      networkError: string
      processingError: string
    }
    accessibility: {
      inputHint: string
      sendButton: string
      closeButton: string
    }
  }
}

export type TranslationKey = keyof Translations
export type NestedTranslationKey<T> = T extends object
  ? {
      [K in keyof T]: T[K] extends object
        ? `${K & string}.${NestedTranslationKey<T[K]> & string}`
        : K & string
    }[keyof T]
  : never

export type FlattenedTranslationKey = NestedTranslationKey<Translations>
