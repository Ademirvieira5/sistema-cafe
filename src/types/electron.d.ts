export {};

declare global {
  interface Window {
    desktop?: {
      isElectron: boolean;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
    };
  }
}
