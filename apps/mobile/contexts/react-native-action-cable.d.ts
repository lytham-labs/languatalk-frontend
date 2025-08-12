declare module '@kesha-antonov/react-native-action-cable' {
  interface Subscription {
    unsubscribe: () => void;
    perform: (action: string, data: any) => void;
  }

  interface Cable {
    setChannel: (name: string, subscription: Subscription) => void;
    channel: (name: string) => Subscription | undefined;
    channels: Record<string, Subscription>;
  }

  interface Consumer {
    disconnect: () => void;
    subscriptions: {
      create: (
        channel: Record<string, any>,
        callbacks: {
          connected?: () => void;
          disconnected?: () => void;
          received?: (data: any) => void;
          rejected?: () => void;
        }
      ) => Subscription;
    };
  }

  const createConsumer: (url: string) => Consumer;
  const Cable: { new(opts: {}): Cable };

  export default { createConsumer, Cable };
}
